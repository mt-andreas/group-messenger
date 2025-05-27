import app from "../src/index";
import supertest from "supertest";
import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { GroupRole, GroupType } from "../src/types/groups.js";

let ownerToken: string;
let adminToken: string;
let memberToken: string;
let groupId: string;
let memberUserId: string;

beforeAll(async () => {
  await app.ready();
  const now = Date.now();

  // Register owner
  const ownerEmail = `owner${now}@banish.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: ownerEmail, password: "pass123", firstName: "Owner", lastName: "User" });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = ownerLogin.body.token;

  // Create group
  const groupRes = await supertest(app.server)
    .post("/api/groups")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Banish Group", type: GroupType.PUBLIC, maxMembers: 10 });

  groupId = groupRes.body.id;

  // Register admin
  const adminEmail = `admin${now}@banish.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: adminEmail, password: "pass123", firstName: "Admin", lastName: "User" });

  const adminLogin = await supertest(app.server).post("/api/auth/login").send({ email: adminEmail, password: "pass123" });

  adminToken = adminLogin.body.token;

  // Join group as admin
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${adminToken}`);

  // Promote to ADMIN
  await supertest(app.server).post(`/api/groups/${groupId}/promote`).set("Authorization", `Bearer ${ownerToken}`).send({ userId: adminLogin.body.user.id });

  // Register member
  const memberEmail = `member${now}@banish.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: memberEmail, password: "pass123", firstName: "Member", lastName: "User" });

  const memberLogin = await supertest(app.server).post("/api/auth/login").send({ email: memberEmail, password: "pass123" });

  memberToken = memberLogin.body.token;
  memberUserId = memberLogin.body.user.id;

  // Join as member
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${memberToken}`);
});

afterAll(async () => {
  await app.close();
});

describe("Group Banish Logic", () => {
  it("allows admin to kick a user (24h ban)", async () => {
    const res = await supertest(app.server).post(`/api/groups/${groupId}/ban`).set("Authorization", `Bearer ${adminToken}`).send({ userId: memberUserId });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/kicked.*24 hours/i);
  });

  it("prevents rejoin during cooldown", async () => {
    const res = await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${memberToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/wait 24 hours/i);
  });

  it("prevents banning the group owner", async () => {
    const res = await supertest(app.server)
      .post(`/api/groups/${groupId}/ban`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: expect.any(String) }); // will override below

    const members = await supertest(app.server).get(`/api/groups/${groupId}/members`).set("Authorization", `Bearer ${ownerToken}`);

    const ownerMember = members.body.find((m: any) => m.role === GroupRole.OWNER);

    const res2 = await supertest(app.server)
      .post(`/api/groups/${groupId}/ban`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: ownerMember.userId });

    expect(res2.statusCode).toBe(403);
    expect(res2.body.message).toMatch(/cannot ban the owner/i);
  });

  it("allows permanent ban from owner", async () => {
    // Create and login new user
    const email = `permban${Date.now()}@ban.com`;
    await supertest(app.server).post("/api/auth/register").send({ email, password: "pass123", firstName: "Ban", lastName: "Forever" });

    const login = await supertest(app.server).post("/api/auth/login").send({ email, password: "pass123" });

    const token = login.body.token;
    const userId = login.body.user.id;

    // Join group
    await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${token}`);

    // Banish permanently
    const ban = await supertest(app.server).post(`/api/groups/${groupId}/ban`).set("Authorization", `Bearer ${ownerToken}`).send({ userId, permanent: true });

    expect(ban.statusCode).toBe(200);
    expect(ban.body.message).toMatch(/permanently banned/i);

    // Attempt rejoin
    const retry = await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${token}`);

    expect(retry.statusCode).toBe(403);
    expect(retry.body.message).toMatch(/permanently banned/i);
  });
});
