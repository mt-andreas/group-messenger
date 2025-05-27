import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import prisma from "../utils/prisma.js";
import { tryCatch } from "../utils/tryCatch.js";
import { errors } from "../utils/errors.js";
import { registerSchema, loginSchema } from "../schemas/authSchema.js";

type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

type LoginRequest = {
  email: string;
  password: string;
};

export default async function (fastify: FastifyInstance) {
  /**
   * Route to register a new user.
   * Validates the request body against the registerSchema.
   * Checks if the email is already registered.
   * If not, hashes the password and creates a new user in the database.
   * Returns the created user's ID and email.
   * @route POST /register
   * @param {RegisterRequest} request.body - The registration details.
   * @returns {Object} - The created user's ID and email.
   */
  fastify.post(
    "/register",
    { schema: registerSchema },
    tryCatch(async (request, reply) => {
      const { email, password, firstName, lastName } = request.body as RegisterRequest;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) throw errors.conflict("Email already registered");

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email: email.toLocaleLowerCase(), password: hashedPassword, firstName, lastName },
      });

      reply.code(201).send({ id: user.id, email: user.email });
    }),
  );

  /**
   * Route to log in a user.
   * Validates the request body against the loginSchema.
   * Checks if the user exists and if the password matches.
   * If successful, generates a JWT token and returns it along with user details.
   * @route POST /login
   * @param {LoginRequest} request.body - The login credentials.
   * @returns {Object} - The JWT token and user details.
   */
  fastify.post(
    "/login",
    { schema: loginSchema },
    tryCatch(async (request, reply) => {
      const { email, password } = request.body as LoginRequest;

      const user = await prisma.user.findUnique({ where: { email: email.toLocaleLowerCase() } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw errors.unauthorized("Invalid email or password");
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "1d" });

      reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    }),
  );
}
