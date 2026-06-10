import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { uploadPublicFile, isStorageConfigured } from '@/lib/storage'
import {
  buildVCardBuffer,
  looksLikeVCard,
  defaultLabel,
  VCARD_CONTENT_TYPE,
} from '@/lib/vcard'

// Max size for an uploaded .vcf file (1MB)
const MAX_UPLOAD_SIZE = 1 * 1024 * 1024

/**
 * Generate an object key for a vCard upload.
 * Mirrors the og-image route key scheme: "vcards/<timestamp>-<rand>.vcf".
 * @returns {string}
 */
function vcardKey() {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `vcards/${timestamp}-${randomStr}.vcf`
}

/**
 * Serialize a MediaAsset row into the public asset JSON shape.
 */
function serializeAsset(asset) {
  return {
    id: asset.id,
    url: asset.url,
    label: asset.label,
    kind: asset.kind,
    contentType: asset.contentType,
    filename: asset.filename,
    sizeBytes: asset.sizeBytes,
    source: asset.source,
    createdAt: asset.createdAt.toISOString(),
  }
}

export async function POST(request) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // Check if cloud storage is configured
    if (!isStorageConfigured()) {
      return NextResponse.json({
        error: 'Cloud storage not configured. Please set up S3/Spaces credentials.',
      }, { status: 500 })
    }

    const contentType = request.headers.get('content-type') || ''

    // Mode "generated": JSON body -> build the vCard server-side
    if (contentType.includes('application/json')) {
      const body = await request.json()

      let buffer
      try {
        buffer = buildVCardBuffer(body)
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      const key = vcardKey()
      const { url } = await uploadPublicFile({
        buffer,
        key,
        contentType: VCARD_CONTENT_TYPE,
      })

      const label = body.label?.trim() || defaultLabel(body)
      const { label: _omitLabel, ...vcardData } = body

      const asset = await prisma.mediaAsset.create({
        data: {
          userId,
          kind: 'vcard',
          contentType: VCARD_CONTENT_TYPE,
          url,
          filename: key,
          sizeBytes: buffer.length,
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

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      if (buffer.length > MAX_UPLOAD_SIZE) {
        return NextResponse.json({ error: 'File too large. Maximum size is 1MB.' }, { status: 400 })
      }

      const text = buffer.toString('utf8')
      if (!looksLikeVCard(text)) {
        return NextResponse.json({
          error: 'File does not appear to be a valid .vcf (vCard) file.',
        }, { status: 400 })
      }

      const key = vcardKey()
      // Force the correct content type so Telnyx interprets it as a contact card.
      const { url } = await uploadPublicFile({
        buffer,
        key,
        contentType: VCARD_CONTENT_TYPE,
      })

      const providedLabel = formData.get('label')
      const label = (typeof providedLabel === 'string' && providedLabel.trim())
        || file.name
        || 'Contact card'

      const asset = await prisma.mediaAsset.create({
        data: {
          userId,
          kind: 'vcard',
          contentType: VCARD_CONTENT_TYPE,
          url,
          filename: key,
          sizeBytes: buffer.length,
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
