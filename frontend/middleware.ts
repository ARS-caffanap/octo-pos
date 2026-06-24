import { NextResponse, type NextRequest } from "next/server";

// PONYTAIL: this is a routing gate, not a security boundary.
// The server never trusts the cookie. The real auth check happens
// on the backend once OCT-6 lands; for now we just bounce unauth'd
// users to /login so deep-links work as expected.
const PUBLIC_PATHS = ["/login"];
const TOKEN_COOKIE = "octopos_token";

function hasTokenShape(token: string | undefined): boolean {
  if (!token) return false;
  // JWT is three base64url segments. Cheap structural check — full
  // verification happens against the backend once OCT-6 is in.
  return token.split(".").length === 3;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (isPublic) {
    // Already logged in? skip the login form.
    if (hasTokenShape(token) && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasTokenShape(token)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
