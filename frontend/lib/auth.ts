// Auth helpers. PONYTAIL: one file, no abstractions.
//
// `login()` is the only network call the login form makes. It throws
// `LoginError` on non-2xx so the form can show a clean message without
// parsing strings. The token is stored in localStorage under "token"
// per the OCT-11 spec; the rest of the app reads it from there.

export const TOKEN_STORAGE_KEY = "token";

export class LoginError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LoginError";
    this.status = status;
  }
}

type LoginResponse = { token?: string; jwt?: string; access_token?: string };

function extractToken(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as LoginResponse;
  return b.token ?? b.jwt ?? b.access_token ?? "";
}

export async function login(email: string, password: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let body: unknown = null;
  // Parse body once; tolerate empty/non-JSON so we can still produce a
  // useful error message.
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : null) ?? `Login failed (${res.status})`;
    throw new LoginError(message, res.status);
  }

  const token = extractToken(body);
  if (!token) {
    throw new LoginError("Login response missing token", res.status);
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    // Also set as cookie so Next.js middleware can read it for route gating.
    // Expires in 1 day (matching backend token TTL).
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `octopos_token=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;
  }
  return token;
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  // Clear the cookie too.
  document.cookie = "octopos_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}
