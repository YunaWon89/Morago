// Address of the API. Empty in development (Vite forwards /api and /socket.io to the API),
// set VITE_API_URL=https://your-api.example.com in production (for example on Vercel).
export const API_URL: string = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
