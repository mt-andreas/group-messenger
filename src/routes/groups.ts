import { FastifyInstance } from 'fastify';
import { createGroupSchema } from '../schemas/groupSchema.js';
import { tryCatch } from '../utils/tryCatch.js';
import prisma from '../utils/prisma.js';
import { joinGroupSchema } from '../schemas/groupSchema.js';
import { addHours, isBefore } from 'date-fns';

enum GroupType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

enum GroupRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export default async function groupRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/groups',
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

      const user = request.user as { id: number };

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
    '/api/groups/:id/join',
    {
      preHandler: [fastify.authenticate],
      schema: joinGroupSchema,
    },
    tryCatch(async (request, reply) => {
      const { id } = request.params as { id: string };
      const groupId = parseInt(id);
      const userId = (request.user as any).id;

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true },
      });

      if (!group) return reply.status(404).send({ message: 'Group not found' });

      const isMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (isMember) {
        return reply.status(400).send({ message: 'Already a member of this group' });
      }

      const ban = await prisma.groupBan.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (ban) {
        if (ban.permanent) {
          return reply.status(403).send({
            message: 'You are permanently banned from this group',
          });
        }

        const lockoutEnds = addHours(ban.createdAt, 24);

        if (isBefore(new Date(), lockoutEnds)) {
          return reply.status(403).send({
            message: 'You must wait 24 hours before rejoining this group',
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

      if (group.type === 'PUBLIC') {
        await prisma.groupMember.create({
          data: {
            userId,
            groupId,
            role: 'MEMBER',
          },
        });

        return reply.send({ message: 'Successfully joined group' });
      } else {
        const existingRequest = await prisma.joinRequest.findUnique({
          where: {
            userId_groupId: { userId, groupId },
          },
        });

        if (existingRequest && existingRequest.status === 'PENDING') {
          return reply.status(409).send({ message: 'Join request already pending' });
        }

        await prisma.joinRequest.upsert({
          where: {
            userId_groupId: { userId, groupId },
          },
          update: {
            status: 'PENDING',
          },
          create: {
            userId,
            groupId,
            status: 'PENDING',
          },
        });

        return reply.send({ message: 'Join request submitted' });
      }
    }),
  );
}
