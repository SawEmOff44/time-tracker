import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin routes (except the login page itself)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const adminCookie = req.cookies.get("admin_session")?.value;

    if (!adminCookie) {
      const loginUrl = new URL("/admin/login", req.url);
      // optional: keep where they were going, to redirect after login later
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Limit middleware to /admin
export const config = {
  matcher: ["/admin/:path*"],
};
