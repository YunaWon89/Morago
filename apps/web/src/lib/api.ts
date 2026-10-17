import { apiUrl } from "./config";
const TOKEN_KEY = "morago_token";

// The token is kept in memory and in localStorage. Memory comes first, so a window keeps its own
// login even if another window of the same browser profile changes or clears the shared storage.
let memoryToken: string | null = null;

export const tokenStore = {
  get: (): string | null => {
    if (memoryToken) return memoryToken;
    try {
      memoryToken = localStorage.getItem(TOKEN_KEY);
    } catch {
      memoryToken = null;
    }
    return memoryToken;
  },
  set: (token: string) => {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // storage is blocked: the login still works until the page is reloaded
    }
  },
  clear: () => {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // nothing to clear
    }
  },
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
    response = await fetch(apiUrl("/api" + path), {
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

// Sends one file as multipart/form-data (the browser sets the Content-Type header itself).
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = tokenStore.get();
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch(apiUrl("/api" + path), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the API running?");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(response.status, data?.error?.message ?? `Request failed (${response.status})`);
  }
  return data as T;
}

// Downloads a private file with the login token (an <a href> or <img src> cannot send it) and returns a blob URL.
export async function apiBlobUrl(path: string): Promise<string> {
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch(apiUrl("/api" + path), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the API running?");
  }
  if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status})`);
  return URL.createObjectURL(await response.blob());
}
