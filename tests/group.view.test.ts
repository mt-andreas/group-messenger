import app from "../src/index";
import supertest from "supertest";
import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { GroupType } from "../src/types/groups.js";

let ownerToken: string;
let joinerToken: string;
let groupId: string;

beforeAll(async () => {
  await app.ready();

  const now = Date.now();

  // Register owner
  const ownerEmail = `owner${now}@view.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: ownerEmail, password: "pass123", firstName: "Owner", lastName: "View" });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = ownerLogin.body.token;

  // Register joiner
  const joinerEmail = `joiner${now}@view.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: joinerEmail, password: "pass123", firstName: "Joiner", lastName: "User" });

  const joinerLogin = await supertest(app.server).post("/api/auth/login").send({ email: joinerEmail, password: "pass123" });

  joinerToken = joinerLogin.body.token;

  // Create private group
  const group = await supertest(app.server)
    .post("/api/groups")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "View Test", type: GroupType.PRIVATE, maxMembers: 5 });

  groupId = group.body.id;

  // Joiner requests to join
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${joinerToken}`);
});

afterAll(async () => {
  await app.close();
});

describe("View Members and Join Requests", () => {
  it("owner can see group members", async () => {
    const res = await supertest(app.server).get(`/api/groups/${groupId}/members`).set("Authorization", `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((m: any) => m.role === "OWNER")).toBe(true);
  });

  it("owner can see pending join requests", async () => {
    const res = await supertest(app.server).get(`/api/groups/${groupId}/requests`).set("Authorization", `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((r: any) => r.user.email.includes("joiner"))).toBe(true);
  });
});
