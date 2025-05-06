import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

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

export default async function ShortlinkRedirect({ params }) {
  const { slug } = params

  try {
    // First find the shortlink
    const shortlink = await prisma.shortlink.findUnique({
      where: { slug }
    })

    if (!shortlink) {
      return <NotFoundPage />
    }

    // Only update click count if we found the shortlink
    // This is where linkclick metric tracking will be added
    await prisma.shortlink.update({
      where: { id: shortlink.id },
      data: { clicks: { increment: 1 } }
    })

    // Ensure the URL has a protocol
    let destinationUrl = shortlink.destination
    if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
      destinationUrl = `https://${destinationUrl}`
    }

    // Now redirect
    redirect(destinationUrl)
  } catch (error) {
    console.error('Redirect error:', error)
    return <NotFoundPage />
  }
}
