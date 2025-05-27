import app from "../src/index";
import supertest from "supertest";
import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { GroupType } from "../src/types/groups.js";

let ownerToken: string;
let joinerToken: string;
let groupId: string;

beforeAll(async () => {
  await app.ready();

  const timestamp = Date.now();

  // Register owner
  const ownerEmail = `owner${timestamp}@test.com`;
  await supertest(app.server).post("/api/auth/register").send({
    email: ownerEmail,
    password: "pass1234",
    firstName: "Owner",
    lastName: "User",
  });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass1234" });

  ownerToken = ownerLogin.body.token;

  // Register joiner
  const joinerEmail = `joiner${timestamp}@test.com`;
  await supertest(app.server).post("/api/auth/register").send({
    email: joinerEmail,
    password: "pass1234",
    firstName: "Joiner",
    lastName: "User",
  });

  const joinerLogin = await supertest(app.server).post("/api/auth/login").send({ email: joinerEmail, password: "pass1234" });

  joinerToken = joinerLogin.body.token;

  // Create public group with owner
  const groupRes = await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({
    name: "Leave Test Group",
    type: GroupType.PUBLIC,
    maxMembers: 10,
  });

  groupId = groupRes.body.id;

  // Joiner joins the group
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${joinerToken}`);
});

afterAll(async () => {
  await app.close();
});

describe("Group Leave Logic", () => {
  it("prevents the owner from leaving the group", async () => {
    const res = await supertest(app.server).post(`/api/groups/${groupId}/leave`).set("Authorization", `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/transfer ownership/i);
  });

  it("allows a member to leave and applies cooldown", async () => {
    const leave = await supertest(app.server).post(`/api/groups/${groupId}/leave`).set("Authorization", `Bearer ${joinerToken}`);

    expect(leave.statusCode).toBe(200);
    expect(leave.body.message).toMatch(/24h/i);
  });

  it("prevents rejoining before 24h cooldown ends", async () => {
    const rejoin = await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${joinerToken}`);

    expect(rejoin.statusCode).toBe(403);
    expect(rejoin.body.message).toMatch(/wait 24 hours/i);
  });
});
