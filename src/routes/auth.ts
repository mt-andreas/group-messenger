import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import prisma from "../utils/prisma.js";
import { tryCatch } from "../utils/tryCatch.js";
import { errors } from "../utils/errors.js";
import { registerSchema, loginSchema } from "../schemas/authSchema.js";

export default async function (fastify: FastifyInstance) {
  fastify.post(
    "/register",
    { schema: registerSchema },
    tryCatch(async (request, reply) => {
      const { email, password, firstName, lastName } = request.body as any;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) throw errors.conflict("Email already registered");

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, firstName, lastName },
      });

      reply.code(201).send({ id: user.id, email: user.email });
    })
  );

  fastify.post(
    "/login",
    { schema: loginSchema },
    tryCatch(async (request, reply) => {
      const { email, password } = request.body as any;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw errors.unauthorized("Invalid email or password");
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
    })
  );
}
