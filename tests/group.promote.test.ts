import app from "../src/index";
import supertest from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { GroupType } from "../src/types/groups.js";

let ownerToken: string;
let memberToken: string;
let groupId: string;
let memberUserId: string;

beforeAll(async () => {
  await app.ready();

  const now = Date.now();

  // Register owner
  const ownerEmail = `owner${now}@promote.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: ownerEmail, password: "pass123", firstName: "Owner", lastName: "Promote" });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = ownerLogin.body.token;

  // Create group
  const group = await supertest(app.server)
    .post("/api/groups")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Promote Test", type: GroupType.PUBLIC, maxMembers: 5 });

  groupId = group.body.id;

  // Register member
  const memberEmail = `member${now}@promote.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: memberEmail, password: "pass123", firstName: "Member", lastName: "User" });

  const memberLogin = await supertest(app.server).post("/api/auth/login").send({ email: memberEmail, password: "pass123" });

  memberToken = memberLogin.body.token;
  memberUserId = memberLogin.body.user.id;

  // Member joins group
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${memberToken}`);
});

afterAll(async () => {
  await app.close();
});

describe("Promote and Transfer Ownership", () => {
  it("owner can promote member to admin", async () => {
    const res = await supertest(app.server).post(`/api/groups/${groupId}/promote`).set("Authorization", `Bearer ${ownerToken}`).send({ userId: memberUserId });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/promoted/i);
  });

  it("owner can transfer ownership", async () => {
    const res = await supertest(app.server)
      .post(`/api/groups/${groupId}/transfer-ownership`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberUserId });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/ownership transferred/i);
  });
});
