import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { mediaPublicUrl } from '@/lib/mediaCard'

/**
 * Serialize a MediaAsset row into the public asset JSON shape.
 * `url` is derived from the id (served by /api/media/[id]/card.vcf).
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

export async function GET(request) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind')

    const assets = await prisma.mediaAsset.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, kind: true, contentType: true, sizeBytes: true, source: true, createdAt: true },
    })

    return NextResponse.json({ assets: assets.map(serializeAsset) })
  } catch (error) {
    console.error('Error listing media assets:', error)
    return NextResponse.json({ error: 'Failed to list media assets' }, { status: 500 })
  }
}
