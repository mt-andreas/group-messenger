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
          case "P2003":
            return reply.status(400).send({ message: "Foreign key constraint failed." });
          case "P2004":
            return reply.status(400).send({ message: "Invalid input." });
          case "P2005":
            return reply.status(400).send({ message: "Invalid data." });
          case "P2016":
            return reply.status(400).send({ message: "No records found." });
          case "P2017":
            return reply.status(400).send({ message: "Invalid query." });

          default:
            return reply.status(500).send({ message: "Database error." });
        }
      }

      if (error.statusCode && error.message) {
        return reply.status(error.statusCode).send({ message: error.message });
      }

      if (error.name === "UnauthorizedError") {
        return reply.status(401).send({ message: "Invalid or expired token." });
      }

      if (error.code === "ERR_CRYPTO_INVALID_IV" || error.code === "ERR_OSSL_BAD_DECRYPT") {
        return reply.status(400).send({ message: "Invalid or corrupt encrypted data." });
      }

      return reply.status(500).send({ message: "Internal server error" });
    }
  };
}
