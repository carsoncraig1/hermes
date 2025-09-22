import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/prisma'

export default async function SlugPage({ params }) {
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
        
        // Return 404 status without custom HTML - appears as broken/timeout
        notFound()
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
    
    // If shortlink not found, return 404
    notFound()
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
      error: error.message,
      redirectTo: 'https://google.com' 
    })
    redirect('https://google.com')
  }
}

