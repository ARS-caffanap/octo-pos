// Minimal API helper. PONYTAIL: one file, no abstractions.
// Reads the JWT from localStorage (set by auth.ts on login) and
// sends it as an Authorization header on every request.

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const token = getToken();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}
