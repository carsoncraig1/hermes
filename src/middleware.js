import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request) {
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for static files and API routes
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

  // Check for JWT token
  const token = await getToken({ 
    req: request, 
    secret: process.env.AUTH_SECRET 
  })
  
  const isLoggedIn = !!token
  const isHermesRoute = pathname.startsWith('/hermes')
  const isAuthRoute = pathname === '/login' || pathname === '/signup'

  // Redirect to login if trying to access protected route while not logged in
  if (isHermesRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if trying to access auth routes while logged in
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/hermes/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
