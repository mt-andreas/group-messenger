import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";

type AsyncHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<any>;

export function tryCatch(handler: AsyncHandler): AsyncHandler {
  return async function (request, reply) {
    try {
      await handler(request, reply);
    } catch (error: any) {
      request.log.error(error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2002":
            return reply.status(409).send({ message: "Record already exists." });
          case "P2025":
            return reply.status(404).send({ message: "Record not found." });
          default:
            return reply.status(500).send({ message: "Database error." });
        }
      }

      if (error.statusCode && error.message) {
        return reply.status(error.statusCode).send({ message: error.message });
      }

      return reply.status(500).send({ message: "Internal server error" });
    }
  };
}
