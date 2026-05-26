import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

export const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;
  const { nextUrl } = req;

  const isAuthPage = 
    nextUrl.pathname.startsWith("/auth/login") || 
    nextUrl.pathname.startsWith("/auth/register") || 
    nextUrl.pathname.startsWith("/auth/photographer") ||
    nextUrl.pathname.startsWith("/login") || 
    nextUrl.pathname.startsWith("/register");

  // Skip auth checks for auth API and registration API
  if (nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname.startsWith("/api/register")) {
    return NextResponse.next();
  }

  // Protected paths (excluding public /gallery)
  const isProtectedRoute = 
    nextUrl.pathname.startsWith("/my-photos") ||
    nextUrl.pathname.startsWith("/upload") ||
    nextUrl.pathname.startsWith("/my-uploads") ||
    nextUrl.pathname.startsWith("/admin");

  if (isProtectedRoute && !isLoggedIn) {
    // Redirect to photographer auth page if trying to access photographer routes, otherwise student login
    const isPhotographerPath = nextUrl.pathname.startsWith("/upload") || nextUrl.pathname.startsWith("/my-uploads");
    const targetLoginPath = isPhotographerPath ? "/auth/photographer" : "/auth/login";
    const loginUrl = new URL(targetLoginPath, nextUrl);
    loginUrl.searchParams.set("next", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users attempting auth pages (redirect to appropriate landing page)
  if (isLoggedIn && isAuthPage) {
    if (userRole === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
    } else if (userRole === "photographer") {
      return NextResponse.redirect(new URL("/upload", nextUrl));
    } else {
      return NextResponse.redirect(new URL("/gallery", nextUrl));
    }
  }

  // Role-based Route Protection
  if (isLoggedIn) {
    // Admin routes protection
    if (nextUrl.pathname.startsWith("/admin") && userRole !== "admin") {
      return NextResponse.redirect(new URL("/gallery", nextUrl));
    }

    // Photographer routes protection (photographer + admin)
    const isPhotographerRoute = nextUrl.pathname.startsWith("/upload") || nextUrl.pathname.startsWith("/my-uploads");
    if (isPhotographerRoute && userRole === "student") {
      return NextResponse.redirect(new URL("/gallery", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Protect all routes except next internals, static files, models, and public images
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|models|r2-mock).*)"],
};
