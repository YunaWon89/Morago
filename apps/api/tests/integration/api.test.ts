import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startTestServer } from "../helpers/server.js";

let server: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
});

test("GET /health answers ok", async () => {
  const response = await server.request("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("security headers are set", async () => {
  const response = await server.request("/health");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("an unknown route returns 404 in the common error format", async () => {
  const response = await server.request("/api/nothing-here");
  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: { message: string } };
  assert.match(body.error.message, /not found/i);
});

test("protected routes need a token", async () => {
  for (const path of ["/api/auth/me", "/api/wallet", "/api/calls", "/api/admin/users"]) {
    const response = await server.request(path);
    assert.equal(response.status, 401, path);
  }
});

test("an invalid token is rejected", async () => {
  const response = await server.request("/api/auth/me", { headers: { Authorization: "Bearer not-a-token" } });
  assert.equal(response.status, 401);
});

test("login validates the request body before touching the database", async () => {
  const response = await server.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { message: string } };
  assert.equal(body.error.message, "Validation failed");
});

test("registration rejects a weak password", async () => {
  const response = await server.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "01012345678", code: "123456", password: "123", fullName: "Test User", email: "t@example.com", role: "USER" }),
  });
  assert.equal(response.status, 400);
});

test("Swagger JSON describes the API", async () => {
  const response = await server.request("/api/docs/openapi.json");
  assert.equal(response.status, 200);
  const body = (await response.json()) as { paths: Record<string, unknown> };
  for (const path of ["/api/auth/login", "/api/auth/forgot-password/phone", "/api/calls", "/api/files"]) {
    assert.ok(body.paths[path], `${path} is documented`);
  }
});

test("Swagger documents errors, new endpoints and the Error schema", async () => {
  const doc = (await (await server.request("/api/docs/openapi.json")).json()) as {
    paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    components: { schemas: Record<string, unknown> };
  };
  assert.ok(doc.components.schemas.Error);
  assert.ok(doc.paths["/api/auth/refresh"]?.post);
  assert.ok(doc.paths["/api/admin/languages"]?.post);
  const getCall = doc.paths["/api/calls/{id}"]?.get;
  assert.ok(getCall?.responses["401"] && getCall.responses["404"] && getCall.responses["500"]);
});

test("refresh and the new file routes need a token", async () => {
  assert.equal((await server.request("/api/auth/refresh", { method: "POST" })).status, 401);
  assert.equal((await server.request("/api/files")).status, 401);
  assert.equal((await server.request("/api/admin/languages")).status, 401);
});
