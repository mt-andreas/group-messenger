import { FastifyInstance } from "fastify";
import { addClient, broadcastToGroup, removeClient } from "../ws/groupSocketManager.js";
import prisma from "../utils/prisma.js";
import { encrypt } from "../utils/encryption.js";
import { User } from "../types/groups.js";
import { GroupMessageResponse } from "types/responses.js";

type WsParams = {
  groupId: string;
};

type GroupMessagePayload = {
  type: "message";
  content: string;
};

/**
 * WebSocket route for group messaging.
 * This route allows authenticated users to connect to a WebSocket for a specific group.
 * It checks if the user is a member of the group before allowing them to send messages.
 * Messages are encrypted before being stored in the database and broadcasted to other group members.
 * @param fastify Fastify instance to register the WebSocket route
 */
export async function groupWsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/ws/groups/:groupId",
    {
      websocket: true,
      preHandler: fastify.authenticate,
    },
    async (conn, request) => {
      const groupId = (request.params as WsParams).groupId;
      const { id: userId, firstName, lastName } = request.user as User;

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

          const createdMessage = await prisma.groupMessage.create({
            data: {
              groupId,
              senderId: userId,
              content: encryptedContent,
            },
          });

          const messageToSend: GroupMessageResponse = {
            id: createdMessage.id,
            groupId,
            sender: {
              id: userId,
              firstName,
              lastName,
            },
            content: encryptedContent, // encrypted message
            createdAt: new Date(),
          };

          broadcastToGroup(messageToSend);
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
