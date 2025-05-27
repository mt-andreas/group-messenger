import { type WebSocket } from "@fastify/websocket";
import { Message } from "types/messages";
import { decrypt } from "utils/encryption.js";
type GroupId = string;

type ClientInfo = {
  userId: string;
  socket: WebSocket;
};

const groupClients = new Map<GroupId, Set<ClientInfo>>();

export function addClient(groupId: string, client: ClientInfo) {
  if (!groupClients.has(groupId)) {
    groupClients.set(groupId, new Set());
  }
  groupClients.get(groupId)!.add(client);
}

export function removeClient(groupId: string, socket: WebSocket) {
  const clients = groupClients.get(groupId);
  if (clients) {
    for (const client of clients) {
      if (client.socket === socket) {
        clients.delete(client);
        break;
      }
    }
    if (clients.size === 0) {
      groupClients.delete(groupId);
    }
  }
}

export function broadcastToGroup(groupId: string, message: Message) {
  const clients = groupClients.get(groupId);
  if (clients) {
    for (const client of clients) {
      const decryptedMessage = decrypt(message.content);
      client.socket.send(JSON.stringify(decryptedMessage));
    }
  }
}
