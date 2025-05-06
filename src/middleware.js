import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function middleware(request) {
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for non-shortlink routes
  if (pathname.startsWith('/hermes') || pathname === '/') {
    return NextResponse.next()
  }

  const slug = pathname.slice(1) // Remove the leading slash
  
  try {
    // Fetch the shortlink data
    const res = await fetch(`${request.nextUrl.origin}/api/shortlinks/${slug}`)
    const data = await res.json()
    
    if (data.destination) {
      // Ensure the URL has a protocol
      let destinationUrl = data.destination
      if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
        destinationUrl = `https://${destinationUrl}`
      }
      
      return NextResponse.redirect(destinationUrl)
    }
  } catch (error) {
    console.error('Middleware redirect error:', error)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/:slug*'
} 