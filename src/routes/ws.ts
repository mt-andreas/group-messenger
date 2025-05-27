import { FastifyInstance } from "fastify";
import { addClient, broadcastToGroup, removeClient } from "../ws/groupSocketManager.js";
import prisma from "../utils/prisma.js";
import { encrypt } from "utils/encryption.js";

type WsParams = {
  groupId: string;
};

type GroupMessagePayload = {
  type: "message";
  content: string;
};

export async function groupWsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/ws/groups/:groupId",
    {
      websocket: true,
      preHandler: fastify.authenticate,
    },
    async (conn, request) => {
      const groupId = (request.params as WsParams).groupId;
      const userId = (request.user as { id: string }).id;

      const isMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId },
        },
      });

      if (!isMember) {
        conn.close(1008, "Not a member of this group");
        return;
      }

      addClient(groupId, { userId, socket: conn });

      conn.on("message", async (messageBuffer: Buffer) => {
        try {
          const message: GroupMessagePayload = JSON.parse(messageBuffer.toString());
          const encryptedContent = encrypt(message.content);

          await prisma.groupMessage.create({
            data: {
              groupId,
              senderId: userId,
              content: encryptedContent,
            },
          });

          broadcastToGroup(groupId, {
            type: "message",
            from: userId,
            content: encryptedContent, // encrypted message
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Error handling message:", err);
        }
      });

      conn.on("close", () => {
        removeClient(groupId, conn);
      });
    },
  );
}
