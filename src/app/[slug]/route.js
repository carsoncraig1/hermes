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
        console.log(`❌ Shortlink disabled: ${slug}`)
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
      
      // Increment the click count
      await prisma.shortlink.update({
        where: { id: shortlink.id },
        data: { clicks: { increment: 1 } }
      })
      
      console.log(`✅ Redirect: ${slug} → ${shortlink.destination} (${shortlink.clicks + 1} clicks)`)
      
      // Redirect to the destination URL
      redirect(shortlink.destination)
    }
    
    console.log(`❌ Shortlink not found: ${slug}`)
    
    // Redirect to non-existent domain to show browser error
    redirect('https://lp.stockstotrade.com/algo-trader')
  } catch (error) {
    // Check if this is a Next.js redirect (which is expected behavior)
    if (error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      // This is a normal redirect, re-throw it
      throw error
    }
    
    console.log(`❌ Shortlink error: ${slug} - ${error.message}`)
    
    // Redirect to non-existent domain to show browser error
    redirect('https://lp.stockstotrade.com/algo-trader')
  }
}
