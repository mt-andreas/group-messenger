import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../src/index";
import prisma from "../src/utils/prisma";
import { encrypt } from "../src/utils/encryption.js";
describe("GET /api/groups/:groupId/messages", () => {
  let ownerToken: string;
  let groupId: string;

  beforeAll(async () => {
    await app.ready();

    // Register and log in user
    await supertest(app.server).post("/api/auth/register").send({
      email: "pagination@example.com",
      password: "password",
      firstName: "Paginate",
      lastName: "User",
    });

    const loginRes = await supertest(app.server).post("/api/auth/login").send({
      email: "pagination@example.com",
      password: "password",
    });

    ownerToken = loginRes.body.token;

    // Create a group
    const groupRes = await supertest(app.server).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({
      name: "Pagination Test Group",
      type: "PUBLIC",
      maxMembers: 5,
    });

    groupId = groupRes.body.id;

    const senderId = loginRes.body.user.id;

    // Insert messages
    for (let i = 0; i < 5; i++) {
      await prisma.groupMessage.create({
        data: {
          groupId,
          senderId,
          content: encrypt("Encrypted Message " + i),
        },
      });
    }
  });

  it("returns paginated messages", async () => {
    const res = await supertest(app.server).get(`/api/groups/${groupId}/messages?limit=2`).set("Authorization", `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.messages.length).toBeLessThanOrEqual(2);
    expect(res.body).toHaveProperty("nextCursor");
  });

  it("fetches next page using cursor", async () => {
    const first = await supertest(app.server).get(`/api/groups/${groupId}/messages?limit=2`).set("Authorization", `Bearer ${ownerToken}`);

    const cursor = first.body.nextCursor;

    if (cursor) {
      const next = await supertest(app.server).get(`/api/groups/${groupId}/messages?limit=2&cursor=${cursor}`).set("Authorization", `Bearer ${ownerToken}`);

      expect(next.statusCode).toBe(200);
      expect(next.body.messages.length).toBeLessThanOrEqual(2);
    }
  });
});
