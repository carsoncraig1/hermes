import { NextResponse } from 'next/server'

export async function middleware(request) {
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for system paths
  if (
    pathname.startsWith('/hermes') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // For all other paths, let the [slug] page component handle the redirect
  // This avoids SSL issues and duplicate logic
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /hermes/* (admin interface)
     * - /api/* (API routes)
     * - /_next/* (Next.js internals)
     * - / (homepage)
     */
    '/((?!hermes|api|_next).*)',
  ]
} 