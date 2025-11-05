import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Public routes
    if (
      pathname === "/login" ||
      pathname === "/api/auth/login" ||
      pathname === "/api/signup"
    ) {
      return NextResponse.next();
    }

    // Require authentication for all other routes
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Check if user account is disabled
    const isActive = token.isActive as boolean | undefined;
    if (isActive === false) {
      // Allow access only to account-disabled page and signout
      if (
        pathname !== "/account-disabled" &&
        !pathname.startsWith("/api/auth/signout")
      ) {
        return NextResponse.redirect(new URL("/account-disabled", req.url));
      }
      return NextResponse.next();
    }

    const userRole = token.role as Role;
    const clinicId = token.clinicId;

    // Role-based access control
    if (pathname.startsWith("/clinics")) {
      if (userRole !== Role.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    if (pathname.startsWith("/users")) {
      if (userRole !== Role.ADMIN && userRole !== Role.CLINIC_ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Clinic scoping for non-ADMIN users
    if (userRole !== Role.ADMIN && !clinicId && pathname !== "/me") {
      return NextResponse.redirect(new URL("/me", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Allow public routes
        if (
          pathname === "/login" ||
          pathname === "/api/auth/login" ||
          pathname === "/api/signup"
        ) {
          return true;
        }

        // Require token for all other routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|og-image.png).*)",
  ],
};
