// OpenAPI description of the MORAGO API. Shown in Swagger UI at /api/docs.

type Method = "get" | "post" | "put" | "patch" | "delete";
type Role = "USER" | "TRANSLATOR" | "ADMIN";

interface Op {
  tag: string;
  summary: string;
  auth?: boolean | Role[];
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  file?: boolean;
  statuses?: number[];
}

const paths: Record<string, Record<string, unknown>> = {};

function add(method: Method, path: string, op: Op) {
  const params: unknown[] = [];
  for (const name of path.match(/\{(\w+)\}/g) ?? []) {
    params.push({ name: name.slice(1, -1), in: "path", required: true, schema: { type: "integer" } });
  }
  for (const [name, type] of Object.entries(op.query ?? {})) {
    params.push({ name, in: "query", required: false, schema: { type } });
  }

  const roles = Array.isArray(op.auth) ? op.auth : [];
  const secured = op.auth !== undefined && op.auth !== false;
  const description = roles.length ? `Roles: ${roles.join(", ")}` : undefined;

  const responses: Record<string, unknown> = {
    "200": { description: "OK" },
    "400": { description: "Validation failed" },
  };
  if (secured) {
    responses["401"] = { description: "Missing or invalid token" };
    if (roles.length) responses["403"] = { description: "Insufficient permissions" };
  }
  for (const status of op.statuses ?? []) {
    responses[String(status)] = { description: status === 201 ? "Created" : `Status ${status}` };
  }

  const requestBody = op.file
    ? {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["file"],
              properties: { file: { type: "string", format: "binary" } },
            },
          },
        },
      }
    : op.body
      ? {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: Object.fromEntries(
                  Object.entries(op.body).map(([key, example]) => [
                    key,
                    { type: typeof example === "number" ? "integer" : typeof example === "boolean" ? "boolean" : "string", example },
                  ]),
                ),
              },
            },
          },
        }
      : undefined;

  paths[path] ??= {};
  paths[path]![method] = {
    tags: [op.tag],
    summary: op.summary,
    description,
    ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
    ...(params.length ? { parameters: params } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
}

const page = { page: "integer", limit: "integer" };

// ---- Auth ----
add("post", "/api/auth/send-code", { tag: "Auth", summary: "Send an SMS code to a phone number (in development the code is returned as devCode)", body: { phone: "01012345678" } });
add("post", "/api/auth/register", { tag: "Auth", summary: "Register a client or a translator", body: { phone: "01012345678", code: "123456", password: "secret1234", fullName: "Kim Dmitrii", email: "kim@example.com", role: "USER" }, statuses: [201, 409] });
add("post", "/api/auth/login", { tag: "Auth", summary: "Log in with phone or email, returns a JWT", body: { login: "01012345678", password: "secret1234" }, statuses: [401] });
add("get", "/api/auth/me", { tag: "Auth", summary: "Current user", auth: true });
add("patch", "/api/auth/profile", { tag: "Auth", summary: "Change my name", auth: true, body: { fullName: "Kim Dmitrii" } });
add("post", "/api/auth/change-password", { tag: "Auth", summary: "Change my password", auth: true, body: { currentPassword: "old", newPassword: "newsecret123" } });
add("post", "/api/auth/forgot-password", { tag: "Auth", summary: "Send a password reset link by email (in development the link is written to the server log)", body: { email: "kim@example.com" } });
add("post", "/api/auth/forgot-password/phone", { tag: "Auth", summary: "Send a 6-digit password reset code by SMS (in development the code is returned as devCode)", body: { phone: "01012345678" } });
add("post", "/api/auth/forgot-password/verify", { tag: "Auth", summary: "Check the SMS code; returns a one-time token for /reset-password", body: { phone: "01012345678", code: "123456" } });
add("post", "/api/auth/reset-password", { tag: "Auth", summary: "Set a new password with the token from the email", body: { token: "…", password: "newsecret123" } });
add("delete", "/api/auth/me", { tag: "Auth", summary: "Delete my account (the account is closed, call and payment history is kept)", auth: true, body: { password: "secret1234" } });

// ---- Reference ----
add("get", "/api/languages", { tag: "Reference", summary: "Languages" });
add("get", "/api/categories", { tag: "Reference", summary: "Categories with their themes (topics)" });

// ---- Files ----
add("post", "/api/files", { tag: "Files", summary: "Upload an image or a PDF (max 5 MB)", auth: true, file: true, statuses: [201] });
add("post", "/api/files/avatar", { tag: "Files", summary: "Upload a picture and make it my avatar", auth: true, file: true, statuses: [201] });
add("get", "/api/files/{id}", { tag: "Files", summary: "Open a file (image or PDF)" });

// ---- Translators ----
add("get", "/api/translators", { tag: "Translators", summary: "List translators (filters: languageId, themeId, online; sorting; pagination)", auth: true, query: { languageId: "integer", themeId: "integer", online: "boolean", sort: "string", ...page } });
add("get", "/api/translators/{id}", { tag: "Translators", summary: "Translator card", auth: true });
add("get", "/api/translators/me", { tag: "Translators", summary: "My translator profile", auth: ["TRANSLATOR"] });
add("patch", "/api/translators/me", { tag: "Translators", summary: "Edit my translator profile", auth: ["TRANSLATOR"], body: { topikLevel: 5, pricePerMinute: 1500 } });
add("put", "/api/translators/me/online", { tag: "Translators", summary: "Go online or offline", auth: ["TRANSLATOR"], body: { isOnline: true } });
add("get", "/api/translators/{id}/reviews", { tag: "Reviews", summary: "Reviews of a translator", auth: true, query: page });

// ---- Calls ----
add("post", "/api/calls", { tag: "Calls", summary: "Request a call to a translator", auth: ["USER"], body: { translatorId: 2, languageId: 1, themeId: 1, type: "AUDIO" }, statuses: [201] });
add("get", "/api/calls", { tag: "Calls", summary: "My call history (filter by status, pagination)", auth: ["USER", "TRANSLATOR"], query: { status: "string", ...page } });
add("get", "/api/calls/{id}", { tag: "Calls", summary: "Call details", auth: true });
add("post", "/api/calls/{id}/accept", { tag: "Calls", summary: "Translator accepts the call", auth: ["TRANSLATOR"] });
add("post", "/api/calls/{id}/reject", { tag: "Calls", summary: "Translator declines the call", auth: ["TRANSLATOR"] });
add("post", "/api/calls/{id}/cancel", { tag: "Calls", summary: "Client cancels the call request", auth: ["USER"] });
add("post", "/api/calls/{id}/start", { tag: "Calls", summary: "Mark the call as started (WebRTC connected)", auth: ["USER", "TRANSLATOR"] });
add("post", "/api/calls/{id}/end", { tag: "Calls", summary: "End the call; duration and cost are calculated", auth: ["USER", "TRANSLATOR"] });
add("post", "/api/calls/{id}/review", { tag: "Reviews", summary: "Rate a finished call (1–5)", auth: ["USER"], body: { rating: 5, comment: "Great translator" }, statuses: [201] });

// ---- Wallet ----
add("get", "/api/wallet", { tag: "Wallet", summary: "Balance and transaction history", auth: true, query: page });
add("get", "/api/wallet/topup-info", { tag: "Wallet", summary: "Bank account for top-ups and the minimum amount", auth: ["USER"] });
add("post", "/api/wallet/topups", { tag: "Wallet", summary: "Create a top-up request (an administrator confirms it)", auth: ["USER"], body: { amount: 30000, senderName: "Kim Dmitrii" }, statuses: [201] });
add("get", "/api/payouts/info", { tag: "Wallet", summary: "Minimum withdrawal amount", auth: ["TRANSLATOR"] });
add("post", "/api/payouts", { tag: "Wallet", summary: "Request a withdrawal", auth: ["TRANSLATOR"], body: { amount: 50000, bankName: "KEB Hana Bank", accountNumber: "123-456-789" }, statuses: [201] });
add("get", "/api/payouts", { tag: "Wallet", summary: "My withdrawal requests", auth: ["TRANSLATOR"] });

// ---- Messages and notifications ----
add("get", "/api/conversations", { tag: "Messages", summary: "My conversations", auth: true });
add("post", "/api/conversations", { tag: "Messages", summary: "Start a conversation with a translator", auth: ["USER"], body: { translatorId: 2 }, statuses: [201] });
add("get", "/api/conversations/{id}/messages", { tag: "Messages", summary: "Messages of a conversation", auth: true, query: page });
add("post", "/api/conversations/{id}/messages", { tag: "Messages", summary: "Send a message", auth: true, body: { text: "Hello" }, statuses: [201] });
add("post", "/api/conversations/{id}/read", { tag: "Messages", summary: "Mark messages as read", auth: true });
add("get", "/api/notifications", { tag: "Notifications", summary: "My notifications", auth: true, query: page });
add("post", "/api/notifications/read-all", { tag: "Notifications", summary: "Mark all notifications as read", auth: true });

// ---- Admin ----
const admin: Role[] = ["ADMIN"];
add("get", "/api/admin/users", { tag: "Admin", summary: "Users (search, filters, pagination)", auth: admin, query: { search: "string", role: "string", status: "string", ...page } });
add("get", "/api/admin/users/{id}", { tag: "Admin", summary: "User details with balance", auth: admin });
add("post", "/api/admin/users/{id}/block", { tag: "Admin", summary: "Block an account", auth: admin, body: { reason: "Spam" } });
add("post", "/api/admin/users/{id}/unblock", { tag: "Admin", summary: "Activate an account", auth: admin });
add("post", "/api/admin/users/{id}/charge", { tag: "Admin", summary: "Add money to a user's balance", auth: admin, body: { amount: 10000 } });
add("get", "/api/admin/users/{id}/transactions", { tag: "Admin", summary: "Transactions of a user", auth: admin, query: page });
add("get", "/api/admin/translators", { tag: "Admin", summary: "Translators with verification status", auth: admin, query: { status: "string", ...page } });
add("patch", "/api/admin/translators/{id}/verification", { tag: "Admin", summary: "Approve, reject or schedule an interview", auth: admin, body: { status: "APPROVED" } });
add("get", "/api/admin/calls", { tag: "Admin", summary: "All calls", auth: admin, query: { userId: "integer", status: "string", ...page } });
add("get", "/api/admin/topups", { tag: "Admin", summary: "Top-up requests", auth: admin, query: { status: "string", ...page } });
add("patch", "/api/admin/topups/{id}", { tag: "Admin", summary: "Confirm or reject a top-up", auth: admin, body: { status: "COMPLETED" } });
add("get", "/api/admin/payouts", { tag: "Admin", summary: "Withdrawal requests", auth: admin, query: { status: "string", ...page } });
add("patch", "/api/admin/payouts/{id}", { tag: "Admin", summary: "Mark a withdrawal as paid or rejected", auth: admin, body: { status: "PAID" } });
add("get", "/api/admin/categories", { tag: "Admin catalog", summary: "All categories including hidden ones", auth: admin });
add("post", "/api/admin/categories", { tag: "Admin catalog", summary: "Create a category", auth: admin, body: { name: "Medicine" }, statuses: [201] });
add("patch", "/api/admin/categories/{id}", { tag: "Admin catalog", summary: "Edit or hide a category", auth: admin, body: { name: "Medicine", isActive: true } });
add("delete", "/api/admin/categories/{id}", { tag: "Admin catalog", summary: "Delete a category (hidden if it has themes)", auth: admin });
add("get", "/api/admin/themes", { tag: "Admin catalog", summary: "All themes including hidden ones", auth: admin });
add("post", "/api/admin/themes", { tag: "Admin catalog", summary: "Create a theme", auth: admin, body: { name: "Hospital", categoryId: 1, isEmergency: false }, statuses: [201] });
add("patch", "/api/admin/themes/{id}", { tag: "Admin catalog", summary: "Edit or hide a theme", auth: admin, body: { name: "Hospital", isActive: true } });
add("delete", "/api/admin/themes/{id}", { tag: "Admin catalog", summary: "Delete a theme (hidden if it was used in calls)", auth: admin });

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "MORAGO API",
    version: "1.0.0",
    description:
      "Translators on call for foreigners in Korea. Log in with POST /api/auth/login, copy the token and press “Authorize”.\n\n" +
      "Real-time events (Socket.io, same host): call:incoming, call:updated, call:signal (WebRTC offer / answer / ice), message:new, notification:new.\n\n" +
      "Errors always look like { \"error\": { \"message\": \"…\", \"details\": [...] } }.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth" }, { name: "Reference" }, { name: "Files" }, { name: "Translators" }, { name: "Calls" },
    { name: "Reviews" }, { name: "Wallet" }, { name: "Messages" }, { name: "Notifications" },
    { name: "Admin" }, { name: "Admin catalog" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
  },
  paths,
};
