# Group Messaging Backend

This is a Node.js backend for a secure group messaging platform supporting public and private groups, user authentication, encrypted messaging, and group management.

## 🔧 Tech Stack

- Node.js
- Fastify
- TypeScript
- Prisma ORM
- PostgreSQL
- Swagger (OpenAPI docs)
- JWT authentication
- Bcrypt for password hashing

## 🚀 Getting Started

### 1. Clone the repo and install dependencies

git clone
cd group-messaging-backend
yarn install

### 2. Set up the database

Ensure you have PostgreSQL running, then update your `.env` file:
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=messenger
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}

### 3. Set up Prisma

npx prisma migrate dev –name init
npx prisma generate

### 4. Start the dev server

yarn dev

http://localhost:3000/docs
to view the Swagger UI documentation.

### 5. Docker

## 🐳 Run with Docker

To start the app with PostgreSQL in containers:

First ensuer you build the app with yarn build

```bash
docker-compose up --build
```

### Groups:

## Task 1: Create Group

📌 Endpoint

POST /api/groups

🔐 Auth Required: Yes (user must be logged in)

📥 Request Body
{
"name": "Solana Enthusiasts",
"type": "PRIVATE",
"maxMembers": 100
}

🧠 Logic
• Must validate input
• Must ensure maxMembers >= 2
• Create a Group with logged-in user as ownerId
• Add owner as GroupMember with role OWNER

## Task 2: Join Group

📌 Endpoint

POST /api/groups/:id/join

🔐 Auth Required: Yes

🧠 Logic
• For PUBLIC groups:
• Immediately add user as MEMBER
• For PRIVATE groups:
• Create a JoinRequest with status PENDING
• Check GroupBan for lockout enforcement
• Prevent joining if already a member

## ✅ Task 3: Leave Group

📌 Endpoint

POST /api/groups/:id/leave

🧠 Logic
• Remove GroupMember
• Add a GroupBan with timestamp
• OWNER cannot leave unless they’ve transferred ownership

## Task 4: Approve/Reject Join Requests

📌 Endpoints
• POST /api/groups/:id/approve
• POST /api/groups/:id/reject

🧠 Logic
• Only OWNER or ADMIN can approve/reject
• Change JoinRequest.status to APPROVED or REJECTED
• Add user to GroupMember if approved

## Task 5: Promote to Admin / Transfer Ownership

📌 Endpoints
• POST /api/groups/:id/promote
• POST /api/groups/:id/transfer-ownership

## Task 6: Kick / Banish User

📌 Endpoint

POST /api/groups/:id/banish

🧠 Logic
• Only OWNER or ADMIN can ban
• Add GroupBan
• Remove from GroupMember

## Task 7: List Group Members & Join Requests

📌 Endpoints
• GET /api/groups/:id/members
• GET /api/groups/:id/requests
