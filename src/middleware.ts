import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/profile(.*)",
  "/onboarding",
  "/api/onboarding",
]);

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

// Simplified middleware - security features can be added back later

export default clerkMiddleware(async (auth, req) => {
  try {
    // Handle protected routes
    if (isProtectedRoute(req)) {
      // Require authentication for protected routes
      await auth.protect();
    }

    // Handle public routes - allow them through
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    // For all other routes, check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();

  } catch (error) {
    console.error('Middleware error:', error);
    
    // For development, let's be more specific about the error
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: 'Middleware error', 
          details: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Security check failed' },
      { status: 500 }
    );
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
