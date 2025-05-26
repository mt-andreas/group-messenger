import { FastifyInstance } from 'fastify';
import { createGroupSchema } from '../schemas/groupSchema.js';
import { tryCatch } from '../utils/tryCatch.js';
import prisma from '../utils/prisma.js';

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
        type: 'PUBLIC' | 'PRIVATE';
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
              role: 'OWNER',
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
}
