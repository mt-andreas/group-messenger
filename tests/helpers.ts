import request from "supertest";
import app from "../src/index.js";
import { afterAll, beforeAll } from "vitest";
import { GroupType } from "../src/types/groups.js";
//import prisma from "../src/utils/prisma.js";
beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  /* await prisma.groupMessage.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();*/
  await app.close();
});

export async function createTestUserAndGroup() {
  const email = `testuser_${Date.now()}@example.com`;
  const password = "password123";

  // Register
  await request(app.server).post("/api/auth/register").send({
    email,
    password,
    firstName: "Test",
    lastName: "User",
  });

  // Login
  const loginRes = await request(app.server).post("/api/auth/login").send({
    email,
    password,
  });

  const token = loginRes.body.token;

  // Create group
  const groupRes = await request(app.server).post("/api/groups").set("Authorization", `Bearer ${token}`).send({
    name: "Test Group",
    type: GroupType.PUBLIC,
    maxMembers: 10,
  });

  const groupId = groupRes.body.id;

  return { token, groupId };
}
