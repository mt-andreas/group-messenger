import { GroupType } from "../types/groups.js";

export const createGroupSchema = {
  body: {
    type: "object",
    required: ["name", "type", "maxMembers"],
    properties: {
      name: { type: "string", minLength: 3 },
      type: { type: "string", enum: [GroupType.PRIVATE, GroupType.PUBLIC] },
      maxMembers: { type: "integer", minimum: 2 },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        type: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
        maxMembers: { type: "number" },
        ownerId: { type: "string", format: "uuid" },
      },
      example: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Example Group",
        type: "PUBLIC",
        maxMembers: 5,
        ownerId: "111e2222-e89b-12d3-a456-426614174000",
      },
    },
  },
};

export const getUserGroupsSchema = {
  querystring: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      offset: { type: "integer", minimum: 0, default: 0 },
      all: { type: "boolean", default: false },
    },
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          type: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
          maxMembers: { type: "number" },
          ownerId: { type: "string", format: "uuid" },
          lastMessage: {
            type: ["object", "null"],
            properties: {
              content: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
            nullable: true,
          },
        },
        example: {
          id: "b3a62c35-4e75-4c6e-9f10-e9c117249b3a",
          name: "Crypto Chat",
          type: "PRIVATE",
          maxMembers: 10,
          ownerId: "c7f9e9a0-f10e-4d44-83e4-e67c7fdb65a7",
          lastMessage: {
            content: "Hey everyone!",
            createdAt: "2025-05-27T10:00:00.000Z",
          },
        },
      },
    },
  },
};

export const joinGroupSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "Successfully joined group",
      },
    },
  },
};

export const leaveGroupSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "You have left the group and must wait 24h to rejoin",
      },
    },
  },
};

export const manageJoinRequestSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" }, // groupId
    },
    required: ["id"],
  },
  body: {
    type: "object",
    properties: {
      userId: { type: "string" },
    },
    required: ["userId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "User join request approved",
      },
    },
  },
};

export const banishUserSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" }, // groupId
    },
    required: ["id"],
  },
  body: {
    type: "object",
    properties: {
      userId: { type: "string" },
      permanent: { type: "boolean" },
    },
    required: ["userId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "User has been kicked and cannot rejoin for 24 hours",
      },
    },
  },
};

export const promoteAdminSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  body: {
    type: "object",
    properties: {
      userId: { type: "string" },
    },
    required: ["userId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "User promoted to admin",
      },
    },
  },
};

export const transferOwnershipSchema = {
  ...promoteAdminSchema,
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "Ownership transferred successfully",
      },
    },
  },
};

export const groupMembersSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          userId: { type: "string", format: "uuid" },
          role: { type: "string" },
          joinedAt: { type: "string", format: "date-time" },
          user: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lstName: { type: "string" },
          },
        },
        example: [
          {
            userId: "5d974a9b-7415-4945-b81a-8c3ba5f31fe6",
            role: "OWNER",
            joinedAt: "2025-05-27T11:09:40.788Z",
            user: {
              id: "5d974a9b-7415-4945-b81a-8c3ba5f31fe6",
              email: "john@example.com",
              firstName: "John",
              lastName: "Doe",
            },
          },
          {
            userId: "cfa778a8-f185-4ef6-93e2-f963cf97f623",
            role: "MEMBER",
            joinedAt: "2025-05-27T11:11:52.274Z",
            user: {
              id: "cfa778a8-f185-4ef6-93e2-f963cf97f623",
              email: "jane@example.com",
              firstName: "Jane",
              lastName: "Doe",
            },
          },
        ],
      },
    },
  },
};

export const groupMessageSchema = {
  params: {
    type: "object",
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
    required: ["groupId"],
  },
  querystring: {
    type: "object",
    properties: {
      cursor: { type: "string", format: "uuid" },
      limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              groupId: { type: "string", format: "uuid" },
              sender: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                },
                required: ["id", "firstName", "lastName"],
              },
              content: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
        nextCursor: { type: ["string", "null"] },
        totalCount: { type: "integer" },
      },
      example: {
        messages: [
          {
            id: "msg-uuid-1",
            groupId: "group-uuid-1",
            sender: {
              id: "user-uuid-1",
              firstName: "John",
              lastName: "Doe",
            },
            content: "Hello World",
            createdAt: "2025-05-28T12:00:00.000Z",
          },
        ],
        nextCursor: null,
        totalCount: 1,
      },
    },
  },
};

export const deleteGroupSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      example: {
        message: "Group deleted successfully",
      },
    },
  },
};

export const sendMessageSchema = {
  params: {
    type: "object",
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
    required: ["groupId"],
  },
  body: {
    type: "object",
    properties: {
      content: { type: "string", minLength: 1 },
    },
    required: ["content"],
  },
  response: {
    201: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        groupId: { type: "string", format: "uuid" },
        sender: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            firstName: { type: "string" },
            lastName: { type: "string" },
          },
          required: ["id", "firstName", "lastName"],
        },
        content: { type: "string" },
        createAt: { type: "string", format: "date-time" },
      },
      example: {
        id: "msg-id-1",
        sender: {
          id: "user-uuid-1",
          firstName: "John",
          lastName: "Doe",
        },
        content: "Test message",
        createAt: "2025-05-28T12:00:00.000Z",
      },
    },
  },
};
