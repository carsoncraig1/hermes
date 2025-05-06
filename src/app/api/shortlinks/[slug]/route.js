import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request, { params }) {
  const { slug } = params
  
  try {
    const shortlink = await prisma.shortlink.findUnique({
      where: { slug }
    })

    if (shortlink) {
      // Increment the click count
      await prisma.shortlink.update({
        where: { id: shortlink.id },
        data: { clicks: { increment: 1 } }
      })
      
      return NextResponse.json({ destination: shortlink.destination })
    }
    
    return NextResponse.json({ error: 'Shortlink not found' }, { status: 404 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 