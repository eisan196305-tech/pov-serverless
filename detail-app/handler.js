const BOOKS = {
  0: {
    id: 0,
    title: "The Comedy of Errors",
    author: "William Shakespeare",
    year: 1595,
    type: "paperback",
    pages: 200,
    publisher: "PublisherA",
    language: "English",
    "ISBN-10": "1234567890",
    "ISBN-13": "123-1234567890",
  },
  1: {
    id: 1,
    title: "Hamlet",
    author: "William Shakespeare",
    year: 1603,
    type: "hardcover",
    pages: 320,
    publisher: "PublisherB",
    language: "English",
    "ISBN-10": "0987654321",
    "ISBN-13": "321-0987654321",
  },
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.detail = async (event) => {
  const id = event.pathParameters?.id;
  const book = BOOKS[id];
  if (!book) return json(404, { error: `book ${id} not found` });
  return json(200, book);
};
