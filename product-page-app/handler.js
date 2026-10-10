const TIMEOUT_MS = 3000;
const VERSIONS = ["v1", "v2", "v3"];

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

// 1) ?version=v3  2) header x-reviews-version  3) weighted random
function pickVersion(event) {
  const forced =
    event.queryStringParameters?.version ?? event.headers?.["x-reviews-version"];
  if (VERSIONS.includes(forced)) return forced;

  const weights = JSON.parse(process.env.REVIEWS_WEIGHTS || "{}");
  const total = VERSIONS.reduce((n, v) => n + (weights[v] ?? 0), 0);
  if (total <= 0) return "v1";
  let roll = Math.random() * total;
  for (const v of VERSIONS) {
    roll -= weights[v] ?? 0;
    if (roll < 0) return v;
  }
  return "v1";
}

function renderDetails(d) {
  const rows = [
    ["ID", d.id],
    ["Author", d.author],
    ["Year", d.year],
    ["Type", d.type],
    ["Pages", d.pages],
    ["Publisher", d.publisher],
    ["Language", d.language],
    ["ISBN-10", d["ISBN-10"]],
    ["ISBN-13", d["ISBN-13"]],
  ];
  return `
    <h3 class="book-title">${esc(d.title)}</h3>
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
}

function renderReviews(data) {
  return data.reviews
    .map((r) => {
      let stars = "";
      if (r.rating?.stars) {
        const color = r.rating.color === "red" ? "#e53935" : "#222";
        stars = `<div class="stars" style="color:${color}">${"★".repeat(
          r.rating.stars
        )}${"☆".repeat(5 - r.rating.stars)}</div>`;
      } else if (r.rating?.error) {
        stars = `<div class="err small">${esc(r.rating.error)}</div>`;
      }
      return `<div class="review">
        <p>${esc(r.text)}</p>
        <div class="who">— ${esc(r.reviewer)}</div>
        ${stars}
      </div>`;
    })
    .join("");
}

exports.productpage = async (event) => {
  const version = pickVersion(event);
  const id = /^\d+$/.test(event.queryStringParameters?.id ?? "")
    ? event.queryStringParameters.id
    : "0";

  const [details, reviews] = await Promise.allSettled([
    getJson(`${process.env.DETAILS_BASE_URL}/details/${id}`),
    getJson(`${process.env.REVIEWS_BASE_URL}/reviews/${version}/${id}`),
  ]);

  const detailsHtml =
    details.status === "fulfilled"
      ? renderDetails(details.value)
      : `<p class="err">Sorry, product details are currently unavailable.</p>`;

  const reviewsHtml =
    reviews.status === "fulfilled"
      ? renderReviews(reviews.value)
      : `<p class="err">Sorry, product reviews are currently unavailable.</p>`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Simple Bookstore App</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,sans-serif;background:#f5f6fa;color:#222}
  header{background:#1f2a44;color:#fff;padding:1.2rem 2rem}
  header h1{margin:0;font-size:1.5rem}
  main{max-width:960px;margin:2rem auto;padding:0 1rem;
       display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
  @media(max-width:700px){main{grid-template-columns:1fr}}
  section{background:#fff;border-radius:10px;padding:1.5rem;
          box-shadow:0 1px 4px rgba(0,0,0,.08)}
  h2{margin-top:0;font-size:1.1rem;color:#1f2a44;
     border-bottom:2px solid #eee;padding-bottom:.5rem}
  .book-title{margin:.5rem 0 1rem;font-size:1.25rem}
  dl{display:grid;grid-template-columns:110px 1fr;gap:.4rem 1rem;margin:0}
  dt{font-weight:600;color:#666}
  dd{margin:0}
  .review{border-left:4px solid #ddd;padding-left:1rem;margin:1rem 0}
  .review p{margin:.2rem 0}
  .who{color:#777;font-size:.9rem}
  .stars{font-size:1.3rem;margin-top:.3rem}
  .err{color:#b00}
  .small{font-size:.9rem}
  .badge{float:right;background:#eef;color:#336;font-size:.75rem;
         padding:.15rem .6rem;border-radius:999px}
</style></head>
<body>
  <header><h1>Simple Bookstore App</h1></header>
  <main>
    <section><h2>Book Details</h2>${detailsHtml}</section>
    <section>
      <h2>Book Reviews <span class="badge">book ${id} · reviews ${version}</span></h2>
      ${reviewsHtml}
    </section>
  </main>
</body></html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: html,
  };
};
