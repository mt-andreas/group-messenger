import { GroupType } from '../types/groups.js';

export const createGroupSchema = {
  body: {
    type: 'object',
    required: ['name', 'type', 'maxMembers'],
    properties: {
      name: { type: 'string', minLength: 3 },
      type: { type: 'string', enum: [GroupType.PRIVATE, GroupType.PUBLIC] },
      maxMembers: { type: 'integer', minimum: 2 },
    },
  },
};

export const joinGroupSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
};

export const leaveGroupSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
};

export const manageJoinRequestSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }, // groupId
    },
    required: ['id'],
  },
  body: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
    },
    required: ['userId'],
  },
};

export const banishUserSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }, // groupId
    },
    required: ['id'],
  },
  body: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      permanent: { type: 'boolean' },
    },
    required: ['userId'],
  },
};

export const promoteAdminSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
  body: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
    },
    required: ['userId'],
  },
};

export const transferOwnershipSchema = promoteAdminSchema;

export const groupIdParamSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
};
