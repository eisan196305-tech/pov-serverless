// exports.reviewv1 = async (event) => {
//   return {
//     statusCode: 200,
//     body: JSON.stringify({
//       message: "Review-app! Version -1 Your function executed successfully!",
//       input: event,
//     }),
//   };
// };

// exports.reviewv2 = async (event) => {
//   return {
//     statusCode: 200,
//     body: JSON.stringify({
//       message: "Review-app! Version -2 Your function executed successfully!",
//       input: event,
//     }),
//   };
// };

// exports.reviewv3 = async (event) => {
//   return {
//     statusCode: 200,
//     body: JSON.stringify({
//       message: "Review-app! Version -3 Your function executed successfully!",
//       input: event,
//     }),
//   };
// };

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const REVIEWS = {
  0: [
    { reviewer: "Reviewer1", text: "Fun and fast-paced, a great read." },
    { reviewer: "Reviewer2", text: "Entertaining, though it lacks some depth." },
  ],
  1: [
    { reviewer: "Reviewer1", text: "A timeless tragedy." },
    { reviewer: "Reviewer2", text: "Dense, but rewarding." },
  ],
};

async function getRatings(id) {
  try {
    const res = await fetch(`${process.env.RATING_BASE_URL}/ratings/${id}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()).ratings;
  } catch {
    return null;
  }
}

const make = (version, color) => async (event) => {
  const id = event.pathParameters?.id;
  const base = REVIEWS[id];
  if (!base) return json({ error: `reviews for book ${id} not found` }, 404);

  const reviews = base.map((r) => ({ ...r }));
  if (color) {
    const ratings = await getRatings(id);
    reviews.forEach((r) => {
      r.rating = ratings
        ? { stars: ratings[r.reviewer], color }
        : { error: "Ratings service is currently unavailable" };
    });
  }
  return json({ id, version, reviews });
};

exports.reviewv1 = make("v1", null);
exports.reviewv2 = make("v2", "black");
exports.reviewv3 = make("v3", "red");
