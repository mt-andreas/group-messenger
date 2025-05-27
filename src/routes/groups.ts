import { FastifyInstance } from "fastify";
import {
  banishUserSchema,
  createGroupSchema,
  deleteGroupSchema,
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
import config from "../utils/config.js";

/**
 * Ensures the user is either an admin or owner of the group.
 * Throws a 403 error if the user is not authorized.
 * @param userId
 * @param groupId
 */
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
/**
 * Group management routes
 * These routes allow users to create, join, leave, and manage groups.
 */
export default async function groupRoutes(fastify: FastifyInstance) {
  /**
   * Create a new group
   * Requires authentication
   * @route POST /groups
   * @body { name: string, type: GroupType, maxMembers: number }
   */
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

  /**
   * Join a group
   * Requires authentication
   * @route POST /groups/:id/join
   * @param {string}
   id - The ID of the group to join
   * @body { userId?: string, permanent?: boolean }
   * If the group is public, the user will be added directly.
   * If the group is private, a join request will be created.
   * If the user is already a member, an error will be returned.
   * If the user is banned, a 403 error will be returned.
   * If the user is temporarily banned, a 403 error will be returned with a retry time.
   * If the user is permanently banned, a 403 error will be returned.
   * @returns {Object} - Success message or error
   * @throws {Error} - 404 if group not found, 400 if already a member, 403 if banned or temporarily banned
   */
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

        const lockoutEnds = addHours(ban.createdAt, config.lockoutHours);

        if (isBefore(new Date(), lockoutEnds)) {
          return reply.status(403).send({
            message: `You must wait ${config.lockoutHours} hours before rejoining this group`,
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

  /**
   * Leave a group
   * Requires authentication
   * @route POST /groups/:id/leave
   * @param {string} id - The ID of the group to leave
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not a member, 400 if trying to leave as owner without transferring ownership
   * @description
   * This route allows a user to leave a group they are a member of.
   * If the user is the owner, they must transfer ownership before leaving.
   * If the user is not a member, a 403 error is returned.
   * After leaving, the user is temporarily banned for x hours to prevent immediate rejoining.
   */
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

      // Add temporary  lockout
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

      return reply.send({ message: `You have left the group and must wait ${config.lockoutHours}h to rejoin` });
    }),
  );

  /**
   * Approve a join request
   * Requires authentication
   * @route POST /groups/:id/approve
   * @param {string} id - The ID of the group
   * @body { userId: string } - The ID of the user to approve
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not an admin or owner, 404 if no pending request found
   * @description
   * This route allows an admin or owner to approve a pending join request.
   * If the user is not an admin or owner, a 403 error is returned.
   * If the request does not exist or is not pending, a 404 error is returned.
   * If approved, the user is added to the group as a member.
   */
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

  /**
   * Reject a join request
   * Requires authentication
   * @route POST /groups/:id/reject
   * @param {string} id - The ID of the group
   * @body { userId: string } - The ID of the user to reject
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not an admin or owner, 404 if no pending request found
   * @description
   * This route allows an admin or owner to reject a pending join request.
   * If the user is not an admin or owner, a 403 error is returned.
   * If the request does not exist or is not pending, a 404 error is returned.
   * If rejected, the request is updated to a REJECTED status.
   */
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

  /**
   * Ban or kick a user from a group
   * Requires authentication
   * @route POST /groups/:id/ban
   * @param {string} id - The ID of the group
   * @body { userId: string, permanent?: boolean } - The ID of the user to ban and whether the ban is permanent
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not an admin or owner, 404 if user is not a member, 400 if trying to ban the owner
   * @description
   * This route allows an admin or owner to ban or kick a user from a group.
   * If the user is not an admin or owner, a 403 error is returned.
   * If the user is not a member of the group, a 404 error is returned.
   * If the user is the owner of the group, a 400 error is returned.
   * If the user is banned, they are removed from the group and a ban record is created.
   * If the ban is permanent, the user cannot rejoin the group.
   * If the ban is temporary, the user can rejoin after x hours.
   * If the user is kicked, they cannot rejoin for x hours.
   */
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
        message: permanent ? `User has been permanently banned from the group` : `User has been kicked and cannot rejoin for ${config.lockoutHours} hours`,
      });
    }),
  );
  /**
   * Promote a user to admin
   * Requires authentication
   * @route POST /groups/:id/promote
   * @param {string} id - The ID of the group
   * @body { userId: string } - The ID of the user to promote
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not the owner, 404 if user is not a member, 400 if user is already an admin or owner
   * @description
   * This route allows the owner of a group to promote a member to admin.
   * If the user is not the owner, a 403 error is returned.
   * If the user is not a member of the group, a 404 error is returned.
   * If the user is already an admin or owner, a 400 error is returned.
   * If the user is successfully promoted, their role is updated to ADMIN.
   */
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

  /**
   * Transfer ownership of a group
   * Requires authentication
   * @route POST /groups/:id/transfer-ownership
   * @param {string} id - The ID of the group
   * @body { userId: string } - The ID of the user to transfer ownership to
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not the owner, 404 if user is not a member, 400 if user is already an owner or admin
   * @description
   * This route allows the owner of a group to transfer ownership to another member.
   * If the user is not the owner, a 403 error is returned.
   * If the user is not a member of the group, a 404 error is returned.
   */
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

  /**
   * Get group members
   * Requires authentication
   * @route GET /groups/:id/members
   * @param {string} id - The ID of the group
   * @returns {Array} - List of group members with their roles and join dates
   * @throws {Error} - 403 if not a member of the group
   */
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

  /**
   * Get pending join requests for a group
   * Requires authentication
   * @route GET /groups/:id/requests
   * @param {string} id - The ID of the group
   * @returns {Array} - List of pending join requests with user details
   * @throws {Error} - 403 if not an admin or owner of the group
   */
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

  /**
   * Delete a group
   * Requires authentication
   * @route DELETE /groups/:id
   * @param {string} id - The ID of the group to delete
   * @returns {Object} - Success message or error
   * @throws {Error} - 403 if not the owner, 404 if group not found, 400 if there are other members
   */
  fastify.delete(
    "/groups/:id",
    {
      preHandler: [fastify.authenticate],
      schema: deleteGroupSchema,
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

  /**
   * Get messages from a group
   * Requires authentication
   * @route GET /groups/:groupId/messages
   * @param {string} groupId - The ID of the group
   * @query {string} cursor - Optional cursor for pagination
   * @query {number} limit - Optional limit for number of messages to return (default 20)
   * @returns {Object} - List of messages with sender ID, content, and timestamp
   * @throws {Error} - 403 if not a member of the group
   */
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
