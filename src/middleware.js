import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname
  
  // Protected routes - require authentication
  const isHermesRoute = pathname.startsWith('/hermes')
  
  // Auth routes - redirect to dashboard if already logged in
  const isAuthRoute = pathname === '/login' || pathname === '/signup'
  
  // Skip middleware for API routes (except protected ones), static files, etc.
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/shortlinks') ||
    pathname === '/favicon.ico' ||
    pathname === '/hermes-favicon.ico' ||
    pathname === '/hermes.png'
  ) {
    return NextResponse.next()
  }

  // Redirect to login if trying to access protected route while not logged in
  if (isHermesRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if trying to access auth routes while logged in
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/hermes/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /_next/* (Next.js internals)
     * - /api/shortlinks/* (public shortlink redirect API)
     * - Static files (favicon, images)
     */
    '/((?!_next/static|_next/image).*)',
  ]
}
