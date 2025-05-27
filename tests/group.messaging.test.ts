import app from "../src/index";
import supertest from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { GroupType } from "../src/types/groups";
let server: Awaited<ReturnType<typeof app.listen>>;

let ownerToken: string;
let joinerToken: string;
let groupId: string;

beforeAll(async () => {
  await app.ready();
  server = await app.listen({ port: 3000 }); // actually start the server for WebSocket tests

  const timestamp = Date.now();

  // Register owner
  const ownerEmail = `owner${timestamp}@test.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: ownerEmail, password: "pass123", firstName: "Owner", lastName: "User" });

  const ownerLogin = await supertest(app.server).post("/api/auth/login").send({ email: ownerEmail, password: "pass123" });

  ownerToken = ownerLogin.body.token;

  // Create group
  const group = await supertest(app.server)
    .post("/api/groups")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "WebSocket Group", type: GroupType.PRIVATE, maxMembers: 5 });

  groupId = group.body.id;

  // Register joiner
  const joinerEmail = `joiner${timestamp}@test.com`;
  await supertest(app.server).post("/api/auth/register").send({ email: joinerEmail, password: "pass123", firstName: "Joiner", lastName: "User" });

  const joinerLogin = await supertest(app.server).post("/api/auth/login").send({ email: joinerEmail, password: "pass123" });

  joinerToken = joinerLogin.body.token;

  // Joiner requests to join
  await supertest(app.server).post(`/api/groups/${groupId}/join`).set("Authorization", `Bearer ${joinerToken}`);

  // Owner approves
  const requests = await supertest(app.server).get(`/api/groups/${groupId}/requests`).set("Authorization", `Bearer ${ownerToken}`);

  const joinReq = requests.body.find((r: any) => r.user.email === joinerEmail);
  await supertest(app.server).post(`/api/groups/${groupId}/approve`).set("Authorization", `Bearer ${ownerToken}`).send({ userId: joinReq.userId });
});

afterAll(async () => {
  await app.close();
  server?.close?.(); // optional safety check
});

describe("WebSocket Messaging", () => {
  it("allows users to send and receive group messages", async () => {
    const receivedMessages: string[] = [];

    const wsOwner = new WebSocket(`ws://localhost:3000/ws/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    const wsJoiner = new WebSocket(`ws://localhost:3000/ws/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${joinerToken}`,
      },
    });

    // Wait for both sockets to connect
    await Promise.all([new Promise((resolve) => wsOwner.once("open", resolve)), new Promise((resolve) => wsJoiner.once("open", resolve))]);

    // Set up the joiner to listen before the owner sends
    const messageReceived = new Promise<string>((resolve) => {
      wsJoiner.on("message", (data) => {
        const text = data.toString();
        receivedMessages.push(text);
        resolve(text);
      });
    });

    // Send a message from the owner
    wsOwner.send(
      JSON.stringify({
        type: "message",
        content: "Hello from owner",
      }),
    );

    // Wait for the joiner to receive it
    const received = await messageReceived;

    expect(received).toContain("Hello from owner");

    wsOwner.close();
    wsJoiner.close();
  });
});
