import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import prisma from "../utils/prisma.js";
import { loginSchema, registerSchema } from "schemas/authSchema.js";

export default async function (fastify: FastifyInstance) {
  fastify.post(
    "/register",
    { schema: registerSchema },
    async (request, reply) => {
      try {
        const { email, password, firstName, lastName } = request.body as {
          email: string;
          password: string;
          firstName: string;
          lastName: string;
        };

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return reply
            .status(400)
            .send({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
          },
        });

        reply.code(201).send({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      } catch (error) {
        request.log.error(error);
        reply.status(500).send({ message: "Internal server error" });
      }
    }
  );

  fastify.post("/login", { schema: loginSchema }, async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ message: "Invalid email or password" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return reply.status(401).send({ message: "Invalid email or password" });
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email });

      reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ message: "Internal server error" });
    }
  });
}
