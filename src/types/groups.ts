import { Group } from "@prisma/client";

export enum GroupType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export enum GroupRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export enum GroupStatus {
  APPROVED = "APPROVED",
  BANNED = "BANNED",
  PENDING = "PENDING",
  REJECTED = "REJECTED",
}

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type GroupWithLastMessage = Group & {
  GroupMessage: {
    content: string;
    createdAt: Date;
  }[];
};
