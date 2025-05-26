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

```bash
docker-compose up --build
```
