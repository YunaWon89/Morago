# Build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t morago-web .
FROM node:22-slim AS build

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

RUN pnpm install --filter "web..."

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
