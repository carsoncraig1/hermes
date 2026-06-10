import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function DELETE(request, { params }) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { id } = params

    const asset = await prisma.mediaAsset.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!asset) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Content lives in the row; Message.mediaAsset and PhoneNumber.mediaAsset are
    // onDelete:SetNull, so references are cleared automatically.
    await prisma.mediaAsset.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting media asset:', error)
    return NextResponse.json({ error: 'Failed to delete media asset' }, { status: 500 })
  }
}
