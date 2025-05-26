export const registerSchema = {
  body: {
    type: "object",
    required: ["email", "password", "firstName", "lastName"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
      firstName: { type: "string", minLength: 1 },
      lastName: { type: "string", minLength: 1 },
    },
  },
};

export const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
    },
  },
};
