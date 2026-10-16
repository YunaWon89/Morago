# MORAGO

A web app where foreigners living in Korea call translators (audio or video) and pay per minute.
Three roles: **USER** (client), **TRANSLATOR** and **ADMIN**.

## What is inside

| Part | Folder | Stack |
| --- | --- | --- |
| API | `apps/api` | Node.js, Express 5, TypeScript, Prisma 7 + MySQL 8.4, Socket.io, zod, JWT |
| Web app | `apps/web` | React 19, Vite, TypeScript, react-router, socket.io-client, WebRTC |
| Shared types | `packages/contracts` | TypeScript |
| Database | `docker-compose.yml` | MySQL 8.4 in Docker |

### Features

- Registration and login by phone, SMS code check (codes are printed in the API console in development).
- Password recovery by SMS code, change password, delete account.
- Client: balance and top-up requests, choosing a topic and a translator, audio/video call (WebRTC), rating after a call, call history, chat with translators, notifications.
- Translator: profile with languages and topics (admin verifies it), online status, incoming calls, earnings and payout requests.
- Admin panel (`/admin`): users, translators, top-ups, payouts, themes and categories.
- Files: avatar upload (jpg, png, webp, pdf, up to 5 MB).
- API documentation (Swagger UI) and request logging.

Money rules: the platform keeps a commission from every call (`PLATFORM_COMMISSION_PERCENT`, 20 % by default).
Top-ups and payouts are handled manually by an admin.

## Run locally

Requirements: a recent Node.js (LTS), pnpm, Docker Desktop (it must be running).

```powershell
# 1. Install packages
pnpm install

# 2. Start MySQL (port 3307 on your computer)
docker compose up -d

# 3. Create the API settings file and edit it (see the table below)
Copy-Item apps/api/.env.example apps/api/.env

# 4. Create the tables and the Prisma client
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma generate

# 5. Fill languages, categories and themes
pnpm exec tsx prisma/seed.ts

# 6. Create the first admin (uses ADMIN_* values from .env)
pnpm exec tsx prisma/create-admin.ts
cd ../..

# 7. Start the API (http://localhost:3000) and the web app (http://localhost:5173)
pnpm dev
```

Open <http://localhost:5173>. The admin panel is at <http://localhost:5173/admin/login>.
Swagger UI: <http://localhost:3000/api/docs> (JSON: `/api/docs/openapi.json`).

If port 3000 is busy, an old API process is still running; stop it and start again.

### Environment variables (`apps/api/.env`)

| Name | Meaning | Default |
| --- | --- | --- |
| `DATABASE_URL` | MySQL connection string | required |
| `JWT_SECRET` | secret for tokens, 32+ characters | required |
| `JWT_EXPIRES_IN_DAYS` | token lifetime | 7 |
| `PORT` | API port | 3000 |
| `CLIENT_URL` | address(es) of the web app, comma separated (CORS) | http://localhost:5173 |
| `RATE_LIMIT_AUTH_MAX` | auth requests per IP per 15 min | 30 |
| `VITE_API_URL` (web) | API address for production build; empty in dev (Vite proxy) | |
| `PLATFORM_COMMISSION_PERCENT` | platform commission | 20 |
| `TOPUP_BANK_NAME`, `TOPUP_ACCOUNT_NUMBER` | bank details shown on the top-up screen | demo values |
| `TOPUP_MIN_AMOUNT`, `PAYOUT_MIN_AMOUNT` | minimum top-up / payout, won | 10000 / 50000 |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | where files are stored and the size limit | uploads / 5 |
| `ADMIN_PHONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | only for `create-admin.ts` | - |

The web app has no settings file: Vite forwards `/api` and `/socket.io` to `http://localhost:3000` (`apps/web/vite.config.ts`).

## Try a call with two people

1. Open the app in two separate browser windows (or one normal and one private window). The login is stored per tab.
2. Window 1: register or log in as a client and top up the balance (an admin approves top-ups in the admin panel).
3. Window 2: log in as a translator, fill in the profile, wait for admin approval, switch **Available**.
4. Window 1: choose a topic, choose the translator, press **Call**. Window 2: accept.
5. After the call the client rates the translator.

Both windows must allow the microphone (and the camera for video).

## API testing

- Swagger UI: <http://localhost:3000/api/docs>.
- Postman: import `docs/MORAGO.postman_collection.json`. Run **POST /api/auth/login** first (change the phone and password in its body); the token is saved automatically and used by all other requests. The `baseUrl` variable is `http://localhost:3000`.
- `docs/openapi.json` is the same API description as a file.

## Tests, CI, Docker

- `pnpm --filter api test` - unit and integration tests (15)
- `pnpm --filter api typecheck`, `pnpm --filter web exec tsc -b`
- GitHub Actions: `.github/workflows/ci.yml` (typecheck, build, tests)
- Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile` (not yet tested in production)
- Architecture: `docs/architecture/overview.md`

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | API and web app together |
| `pnpm --filter web exec tsc -b` | type check of the web app |
| `pnpm --filter api exec prisma migrate deploy` | apply database migrations |
| `pnpm --filter api exec prisma studio` | look into the database in a browser |

## Notes and known limits

- SMS and e-mail providers are not connected yet: messages are printed in the API console, and in development the API also returns the code to the browser (`devCode`). In production (`NODE_ENV=production`) it never does.
- Calls use a public STUN server. For users behind strict networks a TURN server is needed.
- Uploaded files are stored on the API disk (`apps/api/uploads`, not committed).
- Test passwords are not kept in the repository.
