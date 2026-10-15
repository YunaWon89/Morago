const TOKEN_KEY = "morago_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  details: { path: string; message: string }[];

  constructor(status: number, message: string, details: { path: string; message: string }[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let onUnauthorized: (() => void) | null = null;

// Called by the auth provider so that an expired token logs the user out everywhere.
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the API running?");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message: string = data?.error?.message ?? `Request failed (${response.status})`;
    if (response.status === 401 && token && onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError(response.status, message, data?.error?.details ?? []);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details.length > 0) {
      return error.details.map((d) => d.message).join(". ");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}
