export const createGroupSchema = {
  body: {
    type: "object",
    required: ["name", "type", "maxMembers"],
    properties: {
      name: { type: "string", minLength: 3 },
      type: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
      maxMembers: { type: "integer", minimum: 2 },
    },
  },
};
