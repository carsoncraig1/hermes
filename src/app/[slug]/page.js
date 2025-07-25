import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

export default async function SlugPage({ params }) {
  const { slug } = params
  
  try {
    // Look up the shortlink in the database
    const shortlink = await prisma.shortlink.findUnique({
      where: { slug }
    })

    if (shortlink) {
      // Increment the click count
      await prisma.shortlink.update({
        where: { id: shortlink.id },
        data: { clicks: { increment: 1 } }
      })
      
      // Redirect to the destination URL
      redirect(shortlink.destination)
    }
    
    // If shortlink not found, show 404 page
    return <NotFoundPage />
  } catch (error) {
    // Check if this is a Next.js redirect (which is expected behavior)
    if (error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      // This is a normal redirect, re-throw it
      throw error
    }
    
    // Log actual errors
    console.error('Error handling shortlink:', error)
    return <NotFoundPage />
  }
}

const NotFoundPage = () => (
  <div style={{
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
    margin: 0,
    padding: 0
  }}>
    <div style={{ textAlign: 'center' }}>
      <h1 style={{
        color: '#FF6B00',
        fontSize: '4rem',
        fontWeight: 'bold',
        marginBottom: '1rem'
      }}>
        TXT.CX
      </h1>
      <div style={{ color: '#FF6B00' }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem'
        }}>
          404
        </h2>
        <p style={{ fontSize: '1.25rem' }}>
          Link not found
        </p>
      </div>
    </div>
  </div>
)
