export const errors = {
  unauthorized: (msg = "Unauthorized") => ({ statusCode: 401, message: msg }),
  conflict: (msg = "Conflict") => ({ statusCode: 409, message: msg }),
  forbidden: (msg = "Forbidden") => ({ statusCode: 403, message: msg }),
  notFound: (msg = "Not found") => ({ statusCode: 404, message: msg }),
  badRequest: (msg = "Bad request") => ({ statusCode: 400, message: msg }),
};
