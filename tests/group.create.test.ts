import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/index.js";
import supertest from "supertest";
import { GroupType } from "../src/types/groups.js";

let token: string;

beforeAll(async () => {
  await app.ready();

  // Register and login user
  const email = `user${Date.now()}@example.com`;

  await supertest(app.server).post("/api/auth/register").send({ email, password: "pass1234", firstName: "Group", lastName: "Owner" });

  const login = await supertest(app.server).post("/api/auth/login").send({ email, password: "pass1234" });

  token = login.body.token;
});

afterAll(async () => {
  await app.close();
});

describe("Group Creation", () => {
  it("creates a public group successfully", async () => {
    const res = await supertest(app.server)
      .post("/api/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Test Group ${Date.now()}`,
        type: GroupType.PUBLIC,
        maxMembers: 10,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.type).toBe(GroupType.PUBLIC);
  });

  it("fails if maxMembers is too small", async () => {
    const res = await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${token}`).send({
      name: "Small Group",
      type: GroupType.PUBLIC,
      maxMembers: 1,
    });

    expect(res.statusCode).toBe(400);
  });
});
