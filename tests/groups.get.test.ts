import app from "../src/index";
import supertest from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { GroupType } from "../src/types/groups";

let token: string;

beforeAll(async () => {
  await app.ready();

  const email = `user${Date.now()}@example.com`;

  await supertest(app.server).post("/api/auth/register").send({ email, password: "pass1234", firstName: "Group", lastName: "User" });

  const login = await supertest(app.server).post("/api/auth/login").send({ email, password: "pass1234" });

  token = login.body.token;

  // Create a group for testing
  await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${token}`).send({
    name: "Test Group 1",
    type: GroupType.PUBLIC,
    maxMembers: 5,
  });

  await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${token}`).send({
    name: "Test Group 2",
    type: GroupType.PUBLIC,
    maxMembers: 10,
  });
});

afterAll(async () => {
  await app.close();
});

describe("GET /groups", () => {
  it("returns only the groups the user is a member of", async () => {
    const res = await supertest(app.server).get("/api/groups").set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((group) => Object.prototype.hasOwnProperty.call(group, "id"))).toBe(true);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("type");
    expect(res.body[0]).toHaveProperty("maxMembers");
    expect(res.body[0]).toHaveProperty("ownerId");
    expect(res.body[0]).toHaveProperty("lastMessage");
  });

  it("returns all groups in the system when all=true is passed", async () => {
    const res = await supertest(app.server).get("/api/groups?all=true").set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(1);
    expect(res.body.every((group) => Object.prototype.hasOwnProperty.call(group, "id"))).toBe(true);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("type");
    expect(res.body[0]).toHaveProperty("maxMembers");
    expect(res.body[0]).toHaveProperty("ownerId");
    expect(res.body[0]).toHaveProperty("lastMessage");
  });
});
