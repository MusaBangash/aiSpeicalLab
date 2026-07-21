import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/** Guards /student and /teacher routes by session + role. */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user.role;

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/student") && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/teacher/console", req.url));
  }
  if (pathname.startsWith("/teacher") && role !== "TEACHER") {
    return NextResponse.redirect(new URL("/student/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*"],
};
