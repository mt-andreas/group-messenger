// src/index.ts
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";

import jwtPlugin from "./plugins/jwt.js";
import auth from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";
import { groupWsRoutes } from "./routes/ws.js";
const app = Fastify({ logger: true });

// Swagger setup
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Group Messaging API",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
});
await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
});

// Load routes, plugins, etc. here
await app.register(jwtPlugin);
await app.register(websocket);
await app.register(auth, { prefix: "/api/auth" });
await app.register(groupRoutes, { prefix: "/api" });
await groupWsRoutes(app);

if (process.env.NODE_ENV !== "test") {
  app.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}

export default app;
