import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the hostname from the request headers
  const hostname = request.headers.get('host') || '';

  // For local development, support subdomain testing via environment variable
  const isLocalDev = hostname.includes('localhost') || hostname.includes('127.0.0.1');

  let subdomain = '';

  if (isLocalDev) {
    // In development, check for subdomain override in URL query params or env
    subdomain = request.nextUrl.searchParams.get('org') ||
                process.env.NEXT_PUBLIC_DEV_SUBDOMAIN || '';
  } else {
    // In production, extract subdomain from hostname
    const parts = hostname.split('.');

    // Check if it's a subdomain (not www or the main domain)
    if (parts.length >= 3) {
      const potentialSubdomain = parts[0];
      if (potentialSubdomain && potentialSubdomain !== 'www') {
        subdomain = potentialSubdomain;
      }
    }
  }

  // Create response with subdomain header if found
  const response = NextResponse.next();

  if (subdomain) {
    response.headers.set('x-organization', subdomain);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - images, fonts (static assets)
     * - api/auth (NextAuth routes don't need org context)
     * - api/download-image (direct download routes)
     * - api/feedback (feedback routes)
     * But INCLUDE api/trpc for organization-aware tRPC requests
     */
    '/((?!api/auth|api/download-image|api/feedback|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|fonts).*)',
  ],
};