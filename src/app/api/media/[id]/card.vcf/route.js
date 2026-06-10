import prisma from '@/lib/prisma'

// PUBLIC, unauthenticated route: Telnyx (and MMS handsets) fetch the .vcf here.
// Mirrors the public Telnyx webhook — no auth() call. The id is an unguessable
// cuid and vCards are low-sensitivity business cards.
export async function GET(request, { params }) {
  try {
    const { id } = params

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { content: true, contentType: true, label: true },
    })

    if (!asset) {
      return new Response('Not found', { status: 404 })
    }

    const filename = `${(asset.label || 'contact').replace(/[^\w.-]+/g, '_')}.vcf`

    return new Response(asset.content, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType || 'text/vcard',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('Error serving media asset:', error)
    return new Response('Error', { status: 500 })
  }
}
