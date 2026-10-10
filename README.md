# pov-serverless — Bookinfo on AWS Lambda

A proof-of-concept that re-implements the [Istio Bookinfo](https://istio.io/latest/docs/examples/bookinfo/)
sample as four independent **Serverless Framework** services on AWS Lambda + API Gateway (HTTP API),
instead of Kubernetes pods with an Istio service mesh.

> Istio itself does not run on Lambda. This lab keeps Bookinfo's microservice shape and replaces
> the mesh features with plain AWS / application-level equivalents (see [Istio vs. this lab](#istio-vs-this-lab)).

## Architecture

```
                         ┌──────────────► details-app   GET /details/{id}
Browser ──► product-page-app
 GET /productpage        │
 ?id=0&version=v2        └──► review-app  GET /reviews/{v1|v2|v3}/{id}
                                   │
                                   └─(v2, v3 only)──► rating-app  GET /ratings/{id}
```

| Service | Folder | Runtime | Endpoint | Role |
|---|---|---|---|---|
| productpage | `product-page-app/` | Node.js 24 (arm64) | `GET /productpage` | Renders the HTML page; calls details and reviews in parallel |
| details | `detail-app/` | Node.js 24 (arm64) | `GET /details/{id}` | Book information (JSON) |
| reviews | `review-app/` | Node.js 24 (arm64) | `GET /reviews/v1/{id}`, `/v2/{id}`, `/v3/{id}` | Reviews; v2 adds black stars, v3 red stars |
| ratings | `rating-app/` | Node.js 24 (arm64) | `GET /ratings/{id}` | Per-reviewer ratings (JSON) |

Sample data: book ids `0` (*The Comedy of Errors*) and `1` (*Hamlet*). Unknown ids return `404`.

### Reviews versions

| Version | Calls ratings? | Output |
|---|---|---|
| `v1` | No | Review text only |
| `v2` | Yes | Black stars |
| `v3` | Yes | Red stars |

If the ratings service is unreachable, v2/v3 still respond and show *"Ratings service is currently unavailable"*.
If details or reviews fail, productpage still renders and shows an error only in that section
(`Promise.allSettled`).

## Prerequisites

- Node.js 24+ (the handlers use the built-in `fetch`)
- AWS credentials configured for the target account (default region in this lab: `us-east-1`)
- [Serverless Framework](https://www.serverless.com/) v4 (`npm i -g serverless`) and a login / access key
  matching the `org` in each `serverless.yml`

## Deploy

Services depend on each other's URLs, so deploy in this order and copy each endpoint host
into the next service's `serverless.yml`.

1. **rating-app**
   ```bash
   cd rating-app && serverless deploy
   ```
   Copy the host (e.g. `abc123.execute-api.us-east-1.amazonaws.com`).

2. **review-app** — set `RATING_BASE_URL` to the ratings host, then:
   ```bash
   cd review-app && serverless deploy
   ```

3. **detail-app**
   ```bash
   cd detail-app && serverless deploy
   ```

4. **product-page-app** — set `DETAILS_BASE_URL` and `REVIEWS_BASE_URL`, then:
   ```bash
   cd product-page-app && serverless deploy
   ```

> **Base URLs are host only.** Use `https://<id>.execute-api.us-east-1.amazonaws.com` —
> no trailing path and no `{id}`. The code appends `/details/{id}`, `/reviews/{v}/{id}` and
> `/ratings/{id}` itself. Putting a path in the variable produces URLs like `/details/details/0` (404).

### Configuration

| Service | Variable | Meaning |
|---|---|---|
| product-page-app | `DETAILS_BASE_URL` | Host of the details API |
| product-page-app | `REVIEWS_BASE_URL` | Host of the reviews API |
| product-page-app | `REVIEWS_WEIGHTS` | JSON weights for random version choice, e.g. `{"v1":34,"v2":33,"v3":33}` |
| review-app | `RATING_BASE_URL` | Host of the ratings API |

Changing an environment variable requires a redeploy of that service.

## Usage

Open the `product-page-app` endpoint printed by `serverless deploy`:

```
https://<productpage-host>/productpage
https://<productpage-host>/productpage?id=1&version=v3
```

| Parameter | Default | Description |
|---|---|---|
| `id` | `0` | Book id (digits only) |
| `version` | weighted random | Force a reviews version: `v1`, `v2`, `v3`. Can also be set via the `x-reviews-version` header |

Test an individual service directly:

```bash
curl https://<details-host>/details/0
curl https://<ratings-host>/ratings/0
curl https://<reviews-host>/reviews/v2/0
```

## Experiments

- **Traffic shifting** — change `REVIEWS_WEIGHTS` (e.g. `{"v1":90,"v2":0,"v3":10}`), redeploy
  `product-page-app`, and refresh repeatedly. Equivalent to an Istio `VirtualService` weight split.
- **Resilience** — `cd rating-app && serverless remove`, then load `?version=v2`: reviews still render,
  stars are replaced by an error message.
- **Failure isolation** — remove `detail-app`: the reviews panel keeps working.
- **Tracing / latency** — enable X-Ray or the Datadog Lambda extension and compare the
  synchronous call chain (productpage → reviews → ratings) against the EKS version of Bookinfo.

## Istio vs. this lab

| Istio / Kubernetes | This lab |
|---|---|
| Ingress Gateway | API Gateway HTTP API (one per service) |
| `VirtualService` weighted routing | `REVIEWS_WEIGHTS` + `?version=` / header override in productpage |
| Sidecar mTLS, `AuthorizationPolicy` | Not implemented — all APIs are public (lab only) |
| Retries / timeouts | 3 s `AbortSignal.timeout` per call; no retries |
| Fault injection | Remove a service, or add delay/error in a handler |
| Kiali / Jaeger | CloudWatch Logs (X-Ray / Datadog optional) |

## Known limitations

- Every API Gateway endpoint is public and unauthenticated; add authorizers or IAM auth before anything real.
- Services call each other over public HTTPS, not via Lambda `Invoke` or a private network.
- Synchronous call chains pay for cold starts and idle waiting time; this is the main thing the lab is meant to expose.
- Endpoint ids change when a service is removed and redeployed — update the dependent `*_BASE_URL` values.

## Cleanup

```bash
for d in product-page-app review-app detail-app rating-app; do (cd $d && serverless remove); done
```

## Layout

```
pov-serverless/
├── detail-app/        # details service
├── rating-app/        # ratings service
├── review-app/        # reviews v1/v2/v3 (three functions, one service)
├── product-page-app/  # HTML frontend / aggregator
└── lab-01/            # initial Serverless Framework hello-world experiment
```
