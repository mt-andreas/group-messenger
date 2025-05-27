import { FastifyInstance } from "fastify";
import {
  banishUserSchema,
  createGroupSchema,
  groupIdParamSchema,
  groupMessageSchema,
  leaveGroupSchema,
  manageJoinRequestSchema,
  promoteAdminSchema,
  transferOwnershipSchema,
} from "../schemas/groupSchema.js";
import { tryCatch } from "../utils/tryCatch.js";
import prisma from "../utils/prisma.js";
import { joinGroupSchema } from "../schemas/groupSchema.js";
import { addHours, isBefore } from "date-fns";
import { GroupRole, GroupStatus, GroupType, User } from "../types/groups.js";
import { decrypt } from "../utils/encryption.js";

async function ensureAdminOrOwner(userId: string, groupId: string) {
  const member = await prisma.groupMember.findUnique({
    where: {
      userId_groupId: { userId, groupId },
    },
  });

  if (!member || (member.role !== GroupRole.OWNER && member.role !== GroupRole.ADMIN)) {
    throw {
      statusCode: 403,
      message: "You must be an admin or owner to manage join requests",
    };
  }
}

export default async function groupRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/groups",
    {
      preHandler: [fastify.authenticate],
      schema: createGroupSchema,
    },
    tryCatch(async (request, reply) => {
      const { name, type, maxMembers } = request.body as {
        name: string;
        type: GroupType.PUBLIC | GroupType.PRIVATE;
        maxMembers: number;
      };

      const user = request.user as User;

      const group = await prisma.group.create({
        data: {
          name,
          type,
          maxMembers,
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: GroupRole.OWNER,
            },
          },
        },
        include: {
          members: true,
        },
      });

      return reply.code(201).send({
        id: group.id,
        name: group.name,
        type: group.type,
        maxMembers: group.maxMembers,
        ownerId: group.ownerId,
      });
    }),
  );

  fastify.post(
    "/groups/:id/join",
    {
      preHandler: [fastify.authenticate],
      schema: joinGroupSchema,
    },
    tryCatch(async (request, reply) => {
      const { id } = request.params as { id: string };
      const groupId = id;
      const userId = (request.user as User).id;

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true },
      });

      if (!group) return reply.status(404).send({ message: "Group not found" });

      const isMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (isMember) {
        return reply.status(400).send({ message: "Already a member of this group" });
      }

      const ban = await prisma.groupBan.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (ban) {
        if (ban.permanent) {
          return reply.status(403).send({
            message: "You are permanently banned from this group",
          });
        }

        const lockoutEnds = addHours(ban.createdAt, 24);

        if (isBefore(new Date(), lockoutEnds)) {
          return reply.status(403).send({
            message: "You must wait 24 hours before rejoining this group",
            retryAt: lockoutEnds,
          });
        }

        // Cooldown expired — lift temporary ban
        await prisma.groupBan.delete({
          where: {
            userId_groupId: { userId, groupId },
          },
        });
      }

      if (group.type === GroupType.PUBLIC) {
        await prisma.groupMember.create({
          data: {
            userId,
            groupId,
            role: GroupRole.MEMBER,
          },
        });

        return reply.send({ message: "Successfully joined group" });
      } else {
        const existingRequest = await prisma.joinRequest.findUnique({
          where: {
            userId_groupId: { userId, groupId },
          },
        });

        if (existingRequest && existingRequest.status === GroupStatus.PENDING) {
          return reply.status(409).send({ message: "Join request already pending" });
        }

        await prisma.joinRequest.upsert({
          where: {
            userId_groupId: { userId, groupId },
          },
          update: {
            status: GroupStatus.PENDING,
          },
          create: {
            userId,
            groupId,
            status: GroupStatus.PENDING,
          },
        });

        return reply.send({ message: "Join request submitted" });
      }
    }),
  );

  fastify.post(
    "/groups/:id/leave",
    {
      preHandler: [fastify.authenticate],
      schema: leaveGroupSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const userId = (request.user as User).id;

      const membership = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (!membership) {
        return reply.status(403).send({ message: "You are not a member of this group" });
      }

      if (membership.role === GroupRole.OWNER) {
        return reply.status(400).send({
          message: "You must transfer ownership before leaving the group",
        });
      }

      // Delete from GroupMember
      await prisma.groupMember.delete({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      // Add temporary 24h lockout
      await prisma.groupBan.upsert({
        where: {
          userId_groupId: { userId, groupId },
        },
        update: {
          createdAt: new Date(),
          permanent: false,
        },
        create: {
          userId,
          groupId,
          permanent: false,
        },
      });

      return reply.send({ message: "You have left the group and must wait 24h to rejoin" });
    }),
  );

  fastify.post(
    "/groups/:id/approve",
    {
      preHandler: [fastify.authenticate],
      schema: manageJoinRequestSchema,
    },
    tryCatch(async (request, reply) => {
      const { id } = request.params as { id: string };
      const groupId = id;
      const { userId } = request.body as { userId: string };
      const actingUserId = (request.user as User).id;

      await ensureAdminOrOwner(actingUserId, groupId);

      const requestExists = await prisma.joinRequest.findUnique({
        where: { userId_groupId: { userId, groupId } },
      });

      if (!requestExists || requestExists.status !== GroupStatus.PENDING) {
        return reply.status(404).send({ message: "No pending request found" });
      }

      await prisma.$transaction([
        prisma.joinRequest.update({
          where: { userId_groupId: { userId, groupId } },
          data: { status: GroupStatus.APPROVED },
        }),
        prisma.groupMember.create({
          data: {
            userId,
            groupId,
            role: GroupRole.MEMBER,
          },
        }),
      ]);

      return reply.send({ message: "Join request approved" });
    }),
  );

  fastify.post(
    "/groups/:id/reject",
    {
      preHandler: [fastify.authenticate],
      schema: manageJoinRequestSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const actingUserId = (request.user as User).id;

      await ensureAdminOrOwner(actingUserId, groupId);

      const requestExists = await prisma.joinRequest.findUnique({
        where: { userId_groupId: { userId, groupId } },
      });

      if (!requestExists || requestExists.status !== GroupStatus.PENDING) {
        return reply.status(404).send({ message: "No pending request found" });
      }

      await prisma.joinRequest.update({
        where: { userId_groupId: { userId, groupId } },
        data: { status: GroupStatus.REJECTED },
      });

      return reply.send({ message: "Join request rejected" });
    }),
  );

  fastify.post(
    "/groups/:id/ban",
    {
      preHandler: [fastify.authenticate],
      schema: banishUserSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const { userId, permanent } = request.body as { userId: string; permanent?: boolean };
      const actingUserId = (request.user as User).id;

      // Ensure acting user is OWNER or ADMIN
      await ensureAdminOrOwner(actingUserId, groupId);

      const target = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (!target) {
        return reply.status(404).send({ message: "Target user is not a member of this group" });
      }

      if (target.role === GroupRole.OWNER) {
        return reply.status(403).send({ message: "You cannot ban the owner of the group" });
      }

      await prisma.$transaction([
        prisma.groupMember.delete({
          where: {
            userId_groupId: { userId, groupId },
          },
        }),
        prisma.groupBan.upsert({
          where: {
            userId_groupId: { userId, groupId },
          },
          update: {
            permanent: permanent ?? false,
            createdAt: new Date(),
          },
          create: {
            userId,
            groupId,
            permanent: permanent ?? false,
          },
        }),
      ]);

      return reply.send({
        message: permanent ? "User has been permanently banned from the group" : "User has been kicked and cannot rejoin for 24 hours",
      });
    }),
  );
  fastify.post(
    "/groups/:id/promote",
    {
      preHandler: [fastify.authenticate],
      schema: promoteAdminSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const actingUserId = (request.user as User).id;

      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group || group.ownerId !== actingUserId) {
        return reply.status(403).send({ message: "Only the owner can promote members to admin" });
      }

      const member = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } },
      });

      if (!member) {
        return reply.status(404).send({ message: "User is not a member of the group" });
      }

      if (member.role === GroupRole.OWNER || member.role === GroupRole.ADMIN) {
        return reply.status(400).send({ message: "User is already an admin or owner" });
      }

      await prisma.groupMember.update({
        where: { userId_groupId: { userId, groupId } },
        data: { role: GroupRole.ADMIN },
      });

      return reply.send({ message: "User promoted to admin" });
    }),
  );

  fastify.post(
    "/groups/:id/transfer-ownership",
    {
      preHandler: [fastify.authenticate],
      schema: transferOwnershipSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const actingUserId = (request.user as User).id;

      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group || group.ownerId !== actingUserId) {
        return reply.status(403).send({ message: "Only the owner can transfer ownership" });
      }

      const target = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } },
      });

      if (!target) {
        return reply.status(404).send({ message: "Target user is not a group member" });
      }

      await prisma.$transaction([
        prisma.group.update({
          where: { id: groupId },
          data: { ownerId: userId },
        }),
        prisma.groupMember.update({
          where: { userId_groupId: { userId, groupId } },
          data: { role: GroupRole.OWNER },
        }),
        prisma.groupMember.update({
          where: { userId_groupId: { userId: actingUserId, groupId } },
          data: { role: GroupRole.ADMIN },
        }),
      ]);

      return reply.send({ message: "Ownership transferred successfully" });
    }),
  );

  fastify.get(
    "/groups/:id/members",
    {
      preHandler: [fastify.authenticate],
      schema: groupIdParamSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const userId = (request.user as User).id;

      const membership = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (!membership) {
        return reply.status(403).send({ message: "You are not a member of this group" });
      }

      const members = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return reply.send(
        members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
      );
    }),
  );

  fastify.get(
    "/groups/:id/requests",
    {
      preHandler: [fastify.authenticate],
      schema: groupIdParamSchema,
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const userId = (request.user as User).id;

      await ensureAdminOrOwner(userId, groupId);

      const requests = await prisma.joinRequest.findMany({
        where: {
          groupId,
          status: GroupStatus.PENDING,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return reply.send(
        requests.map((r) => ({
          userId: r.userId,
          createdAt: r.createdAt,
          user: r.user,
        })),
      );
    }),
  );

  fastify.delete(
    "/groups/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    tryCatch(async (request, reply) => {
      const { id: groupId } = request.params as { id: string };
      const userId = (request.user as User).id;

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: true,
        },
      });

      console.log("Group to delete:", group);

      if (!group) {
        return reply.status(404).send({ message: "Group not found" });
      }

      if (group.ownerId !== userId) {
        return reply.status(403).send({ message: "Only the group owner can delete this group" });
      }

      const memberCount = group.members.length;

      if (memberCount > 1) {
        return reply.status(400).send({
          message: "You must remove all other members before deleting the group",
        });
      }

      await prisma.group.delete({ where: { id: groupId } });

      return reply.send({ message: "Group deleted successfully" });
    }),
  );

  fastify.get<{
    Params: { groupId: string };
    Querystring: { cursor?: string; limit?: number };
  }>("/groups/:groupId/messages", { preHandler: [fastify.authenticate], schema: groupMessageSchema }, async (request, reply) => {
    const { groupId } = request.params;
    const { cursor, limit: rawLimit = 20 } = request.query;
    const limit = Number(rawLimit);
    const userId = (request.user as User).id;

    const isMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });

    if (!isMember) {
      return reply.code(403).send({ message: "You are not a member of this group" });
    }

    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    const nextCursor = messages.length > limit ? messages.pop()?.id : null;

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        from: msg.senderId,
        content: decrypt(msg.content),
        timestamp: msg.createdAt,
      })),
      nextCursor,
    };
  });
}
