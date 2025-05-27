import app from "../src/index";
import supertest from "supertest";
import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { GroupType } from "../src/types/groups.js";

let ownerToken: string;
let secondUserToken: string;
let deletableGroupId: string;
let nonDeletableGroupId: string;

beforeAll(async () => {
  await app.ready();
  const now = Date.now();

  // ✅ Register Owner
  const ownerEmail = `owner${now}@delete.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: ownerEmail, password: "pass123", firstName: "Owner", lastName: "Delete" });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = ownerLogin.body.token;

  // ✅ Create Deletable Group (only the owner)
  const deletable = await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({
    name: "Solo Group",
    type: GroupType.PUBLIC,
    maxMembers: 3,
  });

  deletableGroupId = deletable.body.id;

  // ✅ Create Non-Deletable Group (with another member)
  const nonDeletable = await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({
    name: "Crowded Group",
    type: GroupType.PUBLIC,
    maxMembers: 3,
  });

  nonDeletableGroupId = nonDeletable.body.id;

  // ✅ Register Second User
  const userEmail = `user${now}@delete.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: userEmail, password: "pass123", firstName: "User", lastName: "Extra" });

  const userLogin = await supertest(app.server).post("/api/auth/login").send({ email: userEmail, password: "pass123" });

  secondUserToken = userLogin.body.token;

  // ✅ Second user joins the non-deletable group
  await supertest(app.server).post(`/api/groups/${nonDeletableGroupId}/join`).set("Authorization", `Bearer ${secondUserToken}`);
});

afterAll(async () => {
  await app.close();
});

describe("Group Deletion Logic", () => {
  it("allows owner to delete group if they are the only member", async () => {
    const res = await supertest(app.server).delete(`/api/groups/${deletableGroupId}`).set("Authorization", `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/i);
  });

  it("prevents owner from deleting group with multiple members", async () => {
    const res = await supertest(app.server).delete(`/api/groups/${nonDeletableGroupId}`).set("Authorization", `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/must remove all other members/i);
  });

  it("prevents non-owner from deleting the group", async () => {
    const res = await supertest(app.server).delete(`/api/groups/${nonDeletableGroupId}`).set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/only the group owner/i);
  });
});
