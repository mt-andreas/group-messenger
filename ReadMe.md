# Group Messaging API

A secure group messaging platform built with **Fastify**, **TypeScript**, **Prisma**, **PostgreSQL**, and **WebSockets**. Supports private/public groups, user roles, join requests, bans, and encrypted messaging.

---

## 🚀 Setup Instructions

### 1. Clone and Install

\```
git clone https://github.com/your-org/group-messenger.git
cd group-messenger
yarn install
\```

### 2. Configure Environment Variables

Create a `.env` file:

Remember to keep this information safe, and to change the sensitive values (POSTGRES_PASSWORD,JWT_SECRET, ENCRYPTION_SECRET).

\```
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=messenger
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}
JWT_SECRET=your_jwt_secret
ENCRYPTION_SECRET=your_32_byte_key
LOCKOUT_HOURS=48
\```

### 3. Generate Prisma Client

\```
npx prisma generate
npx prisma migrate dev --name init
\```

### 4. Start Server

\```
yarn dev
\```

Server runs at: `http://localhost:3000`

### 4. Docker

You need to install Docker and docker-compose.

There are two docker files.
If you need to spool up a postgres DB you can use the following command:

\``
docker-compose -f docker-compose-utils.yml up -d
\`

To run the backend service and Postgres

\``
docker-compose up -d --build
\`

Once the container is up you can still connect to `http://localhost:3000`

To take down the containers:
\``
docker-compose down
\`

---

## 📘 API Documentation

To view the Swagger UI documentation.

`http://localhost:3000/docs`

All routes are prefixed with `/api`.

---

### Tests

To run the tests:

\``
yarn test
\`

tests/
├── auth.test.ts # Register & login
├── group.approve.test.ts # Approve/Reject join
├── group.ban.test.ts # Kick/Ban user
├── group.create.test.ts # Create group
├── group.delete.test.ts # Delete group
├── group.getMessages.test.ts # Get group messages
├── group.join.test.ts # Join group (public/private, lockout, ban)
├── group.leave.test.ts # Leave group
├── group.messaging.test.ts # Websocket messaging
├── group.postMessages.test.ts # Post group message
├── group.promote.test.ts # Promote & transfer ownership
├── group.view.test.ts # Get groups
├── groups.get.test.ts # Get groups

---

## 🔐 Security

- AES-128 encryption for all messages
- JWT authentication on every request
- Group owner/admin permissions enforced

---

## ⚠️ Concerns

- WebSocket client messages not persisted if sent before join confirmation
- No user profile UI (only token-based auth tested via API)
