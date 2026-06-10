import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildVCard, looksLikeVCard, defaultLabel, VCARD_CONTENT_TYPE } from '@/lib/vcard'
import { mediaPublicUrl } from '@/lib/mediaCard'

// Max size for an uploaded .vcf (1MB). vCards are tiny; this just guards abuse.
const MAX_UPLOAD_SIZE = 1 * 1024 * 1024

/**
 * Serialize a MediaAsset row into the public asset JSON shape.
 * `url` is derived from the id (served by /api/media/[id]/card.vcf) — no stored URL.
 */
function serializeAsset(asset) {
  return {
    id: asset.id,
    url: mediaPublicUrl(asset.id),
    label: asset.label,
    kind: asset.kind,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    source: asset.source,
    createdAt: asset.createdAt.toISOString(),
  }
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const contentType = request.headers.get('content-type') || ''

    // Mode "generated": JSON body -> build the vCard server-side
    if (contentType.includes('application/json')) {
      const body = await request.json()

      let vcf
      try {
        vcf = buildVCard(body)
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      const label = body.label?.trim() || defaultLabel(body)
      const { label: _omitLabel, ...vcardData } = body

      const asset = await prisma.mediaAsset.create({
        data: {
          userId,
          kind: 'vcard',
          contentType: VCARD_CONTENT_TYPE,
          content: vcf,
          sizeBytes: Buffer.byteLength(vcf, 'utf8'),
          label,
          source: 'generated',
          vcardData,
        },
      })

      return NextResponse.json({ success: true, asset: serializeAsset(asset) })
    }

    // Mode "uploaded": multipart/form-data -> validate and store a provided .vcf
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const text = Buffer.from(await file.arrayBuffer()).toString('utf8')

      if (Buffer.byteLength(text, 'utf8') > MAX_UPLOAD_SIZE) {
        return NextResponse.json({ error: 'File too large. Maximum size is 1MB.' }, { status: 400 })
      }
      if (!looksLikeVCard(text)) {
        return NextResponse.json({
          error: 'File does not appear to be a valid .vcf (vCard) file.',
        }, { status: 400 })
      }

      const providedLabel = formData.get('label')
      const label = (typeof providedLabel === 'string' && providedLabel.trim())
        || file.name
        || 'Contact card'

      const asset = await prisma.mediaAsset.create({
        data: {
          userId,
          kind: 'vcard',
          contentType: VCARD_CONTENT_TYPE,
          content: text,
          sizeBytes: Buffer.byteLength(text, 'utf8'),
          label,
          source: 'uploaded',
          vcardData: null,
        },
      })

      return NextResponse.json({ success: true, asset: serializeAsset(asset) })
    }

    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
  } catch (error) {
    console.error('Error creating contact card:', error)
    return NextResponse.json({ error: 'Failed to create contact card' }, { status: 500 })
  }
}
