// src/types/responses.ts
import { GroupType, GroupWithLastMessage } from "./groups";
import { GroupMember, JoinRequest, GroupMessage } from "@prisma/client";

export type CreateGroupResponse = {
  id: string;
  name: string;
  type: GroupType;
  maxMembers: number;
  ownerId: string;
};

export type GroupResponse = GroupWithLastMessage[];

export type JoinGroupResponse = { message: string; retryAt?: Date };

export type GenericMessageResponse = {
  message: string;
};

export type GroupMembersResponse = Omit<GroupMember, "id">[];

export type RequestsResponse = Omit<JoinRequest, "id">[];

export type GroupMessageResponse = GroupMessage;

export type PaginatedMessagesResponse =
  | {
      messages: GroupMessageResponse[];
      nextCursor: string | null | undefined;
      totalCount: number;
    }
  | { message: string };
