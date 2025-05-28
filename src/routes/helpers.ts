import { GroupWithLastMessage } from "../types/groups.js";
import { decrypt } from "../utils/encryption.js";

export const formatGroups = (groups: GroupWithLastMessage[]) =>
  groups.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    maxMembers: g.maxMembers,
    ownerId: g.ownerId,
    lastMessage: g.GroupMessage[0]
      ? {
          content: decrypt(g.GroupMessage[0].content),
          createdAt: g.GroupMessage[0].createdAt,
        }
      : null,
  }));
