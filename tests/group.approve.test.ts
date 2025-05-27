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
    password: "pass123",
    firstName: "Owner",
    lastName: "User",
  });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = ownerLogin.body.token;

  // Register joiner
  const joinerEmail = `joiner${timestamp}@test.com`;
  await supertest(app.server).post("/api/auth/register").send({
    email: joinerEmail,
    password: "pass123",
    firstName: "Joiner",
    lastName: "User",
  });

  const joinerLogin = await supertest(app.server).post("/api/auth/login").send({ email: joinerEmail, password: "pass123" });

  joinerToken = joinerLogin.body.token;

  // Create private group
  const group = await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({
    name: "Approval Test Group",
    type: GroupType.PRIVATE,
    maxMembers: 5,
  });

  groupId = group.body.id;

  // Joiner requests to join
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${joinerToken}`);
});

afterAll(async () => {
  await app.close();
});

describe("Join Request Approval/Rejection", () => {
  it("allows the owner to approve a join request", async () => {
    const res = await supertest(app.server)
      .post(`/api/groups/${groupId}/approve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: expect.any(String) }); // We'll override this below

    // Fetch all requests to find the joiner’s ID
    const requests = await supertest(app.server).get(`/api/groups/${groupId}/requests`).set("Authorization", `Bearer ${ownerToken}`);

    const joinRequest = requests.body.find((r: any) => r.user.email.includes("joiner"));

    const approve = await supertest(app.server)
      .post(`/api/groups/${groupId}/approve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: joinRequest.userId });

    expect(approve.statusCode).toBe(200);
    expect(approve.body.message).toMatch(/approved/i);
  });

  it("prevents a non-owner from approving requests", async () => {
    const newUserEmail = `other${Date.now()}@test.com`;

    await supertest(app.server).post("/api/auth/register").send({
      email: newUserEmail,
      password: "pass123",
      firstName: "Other",
      lastName: "User",
    });

    const login = await supertest(app.server).post("/api/auth/login").send({ email: newUserEmail, password: "pass123" });

    const otherToken = login.body.token;

    const res = await supertest(app.server)
      .post(`/api/groups/${groupId}/approve`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ userId: "some-user-id" });

    expect(res.statusCode).toBe(403);
  });

  it("can reject a pending request", async () => {
    // New user
    const email = `reject${Date.now()}@test.com`;
    await supertest(app.server).post("/api/auth/register").send({
      email,
      password: "pass123",
      firstName: "Reject",
      lastName: "User",
    });

    const login = await supertest(app.server).post("/api/auth/login").send({ email, password: "pass123" });

    const rejectUserToken = login.body.token;

    await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${rejectUserToken}`);

    // Get user ID
    const requests = await supertest(app.server).get(`/api/groups/${groupId}/requests`).set("Authorization", `Bearer ${ownerToken}`);

    const toReject = requests.body.find((r: any) => r.user.email.includes("reject"));

    const res = await supertest(app.server)
      .post(`/api/groups/${groupId}/reject`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: toReject.userId });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/rejected/i);
  });
});
