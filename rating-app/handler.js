const RATINGS = {
  0: { Reviewer1: 5, Reviewer2: 4 },
  1: { Reviewer1: 3, Reviewer2: 5 },
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.hello = async (event) => {
  const id = event.pathParameters?.id;
  const ratings = RATINGS[id];
  if (!ratings) return json(404, { error: `ratings for book ${id} not found` });
  return json(200, { id: Number(id), ratings });
};
