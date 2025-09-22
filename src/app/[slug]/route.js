import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request, { params }) {
  const { slug } = params
  
  try {
    // Look up the shortlink in the database
    const shortlink = await prisma.shortlink.findUnique({
      where: { slug }
    })

    if (shortlink) {
      // Check if shortlink is enabled
      if (!shortlink.enabled) {
        // Log blocked redirect (shortlink disabled)
        console.log('Blocked redirect - shortlink disabled:', { 
          slug: shortlink.slug, 
          enabled: shortlink.enabled 
        })
        
        // Return corrupted image data to show broken image icon
        return new NextResponse('corrupted-image-data', {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': '0',
            'Cache-Control': 'no-cache'
          }
        })
      }
      
      // Increment the click count
      await prisma.shortlink.update({
        where: { id: shortlink.id },
        data: { clicks: { increment: 1 } }
      })
      
      // Log successful redirect
      console.log('Successful redirect:', { 
        slug: shortlink.slug, 
        destination: shortlink.destination,
        clicks: shortlink.clicks + 1 
      })
      
      // Redirect to the destination URL
      redirect(shortlink.destination)
    }
    
    // Log blocked redirect (shortlink not found)
    console.log('Blocked redirect - shortlink not found:', { 
      slug: slug
    })
    
    // Return corrupted image data to show broken image icon
    return new NextResponse('corrupted-image-data', {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': '0',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    // Check if this is a Next.js redirect (which is expected behavior)
    if (error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      // This is a normal redirect, re-throw it
      throw error
    }
    
    // Log actual errors and blocked redirect due to error
    console.error('Error handling shortlink:', error)
    console.log('Blocked redirect due to error:', { 
      slug: slug, 
      error: error.message
    })
    
    // Return corrupted image data to show broken image icon
    return new NextResponse('corrupted-image-data', {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': '0',
        'Cache-Control': 'no-cache'
      }
    })
  }
}
