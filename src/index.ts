// src/index.ts
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import jwtPlugin from "./plugins/jwt.js";
import auth from "./routes/auth.js";
const app = Fastify({ logger: true });

// Swagger setup
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Group Messaging API",
      version: "1.0.0",
    },
  },
});
await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
});

// Load routes, plugins, etc. here
await app.register(jwtPlugin);
await app.register(auth, { prefix: "/auth" });

app.listen({ port: 3000 }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
