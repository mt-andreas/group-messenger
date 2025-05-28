import request from "supertest";
import app from "../src/index.js";
import { createTestUserAndGroup } from "./helpers.js"; // assume you have helper to create group and user
import { describe, expect, it } from "vitest";

describe("POST /groups/:groupId/messages", () => {
  it("allows an authenticated user to post a message to a group", async () => {
    const { token, groupId } = await createTestUserAndGroup();

    const res = await request(app.server).post(`/api/groups/${groupId}/messages`).set("Authorization", `Bearer ${token}`).send({
      content: "This is a test message",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("from");
    expect(res.body).toHaveProperty("content", "This is a test message");
    expect(new Date(res.body.createdAt)).toBeInstanceOf(Date);
  });
});
