export default {
  lockoutHours: 48,
  encryptionKey: process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef", // 32 hex chars for AES-256
};
