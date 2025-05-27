import app from "../src/index";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GroupType, GroupRole, GroupStatus } from "../src/types/groups.js";

let ownerToken: string;
let joinerToken: string;
let publicGroupId: string;
let privateGroupId: string;

beforeAll(async () => {
  await app.ready();

  const ownerEmail = `owner${Date.now()}@test.com`;
  const joinerEmail = `joiner${Date.now()}@test.com`;

  // Register owner
  await supertest(app.server).post("/api/auth/register").send({ email: ownerEmail, password: "pass123", firstName: "Owner", lastName: "User" });

  const loginOwner = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = loginOwner.body.token;

  // Register joiner
  await supertest(app.server).post("/api/auth/register").send({ email: joinerEmail, password: "pass123", firstName: "Joiner", lastName: "User" });

  const loginJoiner = await supertest(app.server).post("/api/auth/login").send({ email: joinerEmail, password: "pass123" });

  joinerToken = loginJoiner.body.token;

  // Create public group
  const pub = await supertest(app.server)
    .post("/api/groups")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Public Test Group", type: GroupType.PUBLIC, maxMembers: 10 });

  publicGroupId = pub.body.id;

  // Create private group
  const priv = await supertest(app.server)
    .post("/api/groups")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Private Test Group", type: GroupType.PRIVATE, maxMembers: 10 });

  privateGroupId = priv.body.id;
});

afterAll(async () => {
  await app.close();
});

describe("Group Join Logic", () => {
  it("auto-joins a public group successfully", async () => {
    const res = await supertest(app.server).post(`/api/groups/${publicGroupId}/join`).set("Authorization", `Bearer ${joinerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("Successfully joined");
  });

  it("creates a join request for private group", async () => {
    const res = await supertest(app.server).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${joinerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("Join request submitted");
  });

  it("prevents re-request if already pending", async () => {
    const res = await supertest(app.server).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${joinerToken}`);

    expect(res.statusCode).toBe(409);
  });
});
