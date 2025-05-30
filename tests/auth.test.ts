import supertest from "supertest";
import app from "../src/index.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});
const email = `user${Date.now()}@example.com`;

describe("Auth API", () => {
  it("registers a new user", async () => {
    const res = await supertest(app.server).post("/api/auth/register").send({
      email,
      password: "password123",
      firstName: "Test",
      lastName: "User",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("logs in the user", async () => {
    const res = await supertest(app.server).post("/api/auth/login").send({
      email,
      password: "password123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});
