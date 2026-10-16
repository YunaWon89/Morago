# Build from the repository root:  docker build -f apps/api/Dockerfile -t morago-api .
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api

RUN pnpm install --filter "api..."
RUN pnpm --filter api exec prisma generate

ENV NODE_ENV=production
EXPOSE 3000

# Applies database migrations, then starts the API.
CMD ["pnpm", "--filter", "api", "start:prod"]
