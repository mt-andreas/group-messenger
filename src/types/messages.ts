export type Message = {
  type: "message";
  from: string; // User ID of the sender
  content: string; // Message content, will be encrypted later
  timestamp: string; // ISO date string for when the message was sent
};
