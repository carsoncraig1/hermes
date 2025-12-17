import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClickWithHrms, appendHrmsToUrl, generateHrms } from '@/lib/revenue'
import { lookupMessageClickCode, markCodeAsClicked, markCodeAsOpened } from '@/lib/messageClickCodes'

// Bot/crawler User-Agent patterns for link preview fetching
const BOT_PATTERNS = [
  'facebookexternalhit',   // Facebook, Instagram, Messenger
  'Facebot',               // Facebook
  'Twitterbot',            // Twitter/X
  'WhatsApp',              // WhatsApp
  'TelegramBot',           // Telegram
  'LinkedInBot',           // LinkedIn
  'Slackbot',              // Slack
  'Discordbot',            // Discord
  'Googlebot',             // Google
  'bingbot',               // Bing
  'AppleBot',              // Apple
  'iMessageLinkPreview',   // iMessage (newer)
  'MobileSafari.*AppleWebKit.*Version.*Safari', // iMessage fallback pattern
]

function isBotRequest(userAgent) {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some(pattern => 
    ua.includes(pattern.toLowerCase()) || 
    new RegExp(pattern, 'i').test(userAgent)
  )
}

function generateOgHtml(shortlink, destinationWithHrms, code) {
  const { ogImage, ogTitle, ogDescription } = shortlink
  const shortUrl = `https://txt.cx/${code}`
  
  // Convert relative image paths to absolute URLs for OG tags
  const absoluteOgImage = ogImage?.startsWith('/') 
    ? `https://txt.cx${ogImage}` 
    : ogImage
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ogTitle || 'Redirecting...'}</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shortUrl}">
  ${ogTitle ? `<meta property="og:title" content="${ogTitle}">` : ''}
  ${ogDescription ? `<meta property="og:description" content="${ogDescription}">` : ''}
  ${absoluteOgImage ? `<meta property="og:image" content="${absoluteOgImage}">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  ${ogTitle ? `<meta name="twitter:title" content="${ogTitle}">` : ''}
  ${ogDescription ? `<meta name="twitter:description" content="${ogDescription}">` : ''}
  ${absoluteOgImage ? `<meta name="twitter:image" content="${absoluteOgImage}">` : ''}
  
  <!-- Redirect after a brief delay for crawlers to parse OG tags -->
  <meta http-equiv="refresh" content="0;url=${destinationWithHrms}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #111;
      color: #fff;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #FF6B00;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    a {
      color: #FF6B00;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Redirecting...</p>
    <p><a href="${destinationWithHrms}">Click here if not redirected</a></p>
  </div>
  <script>
    window.location.href = "${destinationWithHrms}";
  </script>
</body>
</html>`
}

export async function GET(request, { params }) {
  const { slug } = params // This is now a code, not a slug
  const code = slug // Rename for clarity
  const userAgent = request.headers.get('user-agent') || ''
  const isBot = isBotRequest(userAgent)
  
  try {
    // Check if this is a legacy shortlink (3 characters) or dynamic (5-6 characters)
    const isLegacySlug = code.length === 3 && /^[a-zA-Z0-9]{3}$/.test(code)
    
    let shortlink = null
    let messageClickCode = null
    
    if (isLegacySlug) {
      // Legacy shortlink: lookup by slug
      shortlink = await prisma.shortlink.findUnique({
        where: { slug: code.toLowerCase() },
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
      
      if (!shortlink) {
        const knownPaths = ['robots.txt', 'sitemap.xml', 'sitemap.txt', 'hermes', 'api', 'favicon.ico']
        if (!knownPaths.includes(code)) {
          console.log(`❌ Legacy shortlink not found: ${code}`)
        }
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
      
      // Check if legacy shortlink is enabled
      if (!shortlink.enabled) {
        console.log(`❌ Legacy shortlink disabled: ${code}`)
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
    } else {
      // Dynamic shortlink: lookup MessageClickCode by code (5-6 alphanumeric characters)
      messageClickCode = await lookupMessageClickCode(code);
      
      if (!messageClickCode) {
        // Don't log known paths or common bot requests
        const knownPaths = ['robots.txt', 'sitemap.xml', 'sitemap.txt', 'hermes', 'api', 'favicon.ico']
        if (!knownPaths.includes(code)) {
          console.log(`❌ Click code not found: ${code}`)
        }
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
      
      shortlink = messageClickCode.shortlink;
      
      // Check if shortlink is enabled
      if (!shortlink.enabled) {
        console.log(`❌ Shortlink disabled: ${code}`)
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
    }
    
    // Track opens (bot/preview fetches) vs clicks (real users)
    let hrms = null
    let destinationWithHrms = shortlink.destination
    
    if (isLegacySlug) {
      // Legacy shortlink: simpler tracking (no MessageClickCode, no HRMS)
      if (isBot) {
        // Bot prefetch = "open"
        await prisma.shortlink.update({
          where: { id: shortlink.id },
          data: { opens: { increment: 1 } }
        })
        const openCount = (shortlink.opens ?? 0) + 1
        const shortlinkName = shortlink.nickname || shortlink.slug || `Shortlink #${shortlink.id}`
        console.log(`👁️ Open: ${shortlinkName} (${openCount} opens)`)
      } else {
        // Real user click - simple increment
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
        const referrer = request.headers.get('referer') || null
        
        await prisma.$transaction(async (tx) => {
          // Increment click counter
          await tx.shortlink.update({
            where: { id: shortlink.id },
            data: { clicks: { increment: 1 } }
          })
          
          // Create click record (no HRMS for legacy)
          await tx.shortlinkClick.create({
            data: {
              shortlinkId: shortlink.id,
              userAgent,
              ipAddress,
              referrer
            }
          })
        })
        
        const updatedShortlink = await prisma.shortlink.findUnique({
          where: { id: shortlink.id },
          select: { clicks: true, nickname: true, slug: true }
        })
        const clickCount = updatedShortlink?.clicks ?? 0
        const shortlinkName = updatedShortlink?.nickname || updatedShortlink?.slug || `Shortlink #${shortlink.id}`
        console.log(`✅ Click: ${shortlinkName} (${clickCount} clicks)`)
      }
    } else {
      // Dynamic shortlink: full message-level tracking with HRMS
      const messageId = messageClickCode.messageId;
      const contactId = messageClickCode.contactId;
      const messageClickCodeId = messageClickCode.id;
      
      if (isBot) {
        // Bot prefetch = "open" (user saw the preview in their messages)
        // Don't generate HRMS for bot requests
        await Promise.all([
          prisma.shortlink.update({
            where: { id: shortlink.id },
            data: { opens: { increment: 1 } }
          }),
          // Mark this specific MessageClickCode as opened (first time only)
          !messageClickCode.opened && markCodeAsOpened(code)
        ])
        const openCount = (shortlink.opens ?? 0) + 1
        const shortlinkName = shortlink.nickname || `Shortlink #${shortlink.id}`
        console.log(`👁️ Open: ${shortlinkName} (${openCount} opens)`)
      } else {
        // Real user click - we have full message-level tracking!
        // Use atomic transaction to ensure one click per code, prevent race conditions
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
        const referrer = request.headers.get('referer') || null
        
        // Atomic transaction: check if clicked, mark as clicked, increment counter, create record - all or nothing
        const clickResult = await prisma.$transaction(async (tx) => {
          // Re-fetch the messageClickCode within transaction to get latest state
          const currentCode = await tx.messageClickCode.findUnique({
            where: { code },
            select: { clicked: true, id: true }
          })
          
          // If already clicked, return early - don't count this as a click
          if (!currentCode || currentCode.clicked) {
            return { isNewClick: false, hrms: null }
          }
          
          // Mark as clicked (atomic update)
          await tx.messageClickCode.update({
            where: { code },
            data: {
              clicked: true,
              clickedAt: new Date()
            }
          })
          
          // Generate unique HRMS for this specific click
          const shortlinkForHrms = await tx.shortlink.findUnique({
            where: { id: shortlink.id },
            select: { userId: true, campaignId: true }
          })
          
          if (!shortlinkForHrms) {
            throw new Error('Shortlink not found')
          }
          
          const hrms = generateHrms(shortlinkForHrms.userId, shortlink.id)
          
          // Create click record with unique HRMS (atomic)
          await tx.shortlinkClick.create({
            data: {
              shortlinkId: shortlink.id,
              messageId,
              messageClickCodeId: currentCode.id,
              hrms,
              userAgent,
              ipAddress,
              referrer
            }
          })
          
          // Increment shortlink click counter (atomic)
          await tx.shortlink.update({
            where: { id: shortlink.id },
            data: { clicks: { increment: 1 } }
          })
          
          return { isNewClick: true, hrms }
        })
        
        // Only proceed if this was a new click
        if (clickResult.isNewClick && clickResult.hrms) {
          hrms = clickResult.hrms
          destinationWithHrms = appendHrmsToUrl(shortlink.destination, hrms)
          
          // Get updated click count for logging
          const updatedShortlink = await prisma.shortlink.findUnique({
            where: { id: shortlink.id },
            select: { clicks: true, nickname: true }
          })
          const clickCount = updatedShortlink?.clicks ?? 0
          const shortlinkName = updatedShortlink?.nickname || `Shortlink #${shortlink.id}`
          console.log(`✅ Click: ${shortlinkName} (${clickCount} clicks)`)
        } else {
          // Code was already clicked - this is a refresh/retry, don't count it
          // Still redirect to destination but without HRMS tracking
          destinationWithHrms = shortlink.destination
        }
      }
    }
    
    // If OG preview is enabled, serve HTML with OG meta tags
    if (shortlink.ogEnabled && shortlink.ogImage) {
      const html = generateOgHtml(shortlink, destinationWithHrms, code)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }
    
    // Otherwise, redirect directly to the destination URL with hrms
    redirect(destinationWithHrms)
  } catch (error) {
    // Check if this is a Next.js redirect (which is expected behavior)
    if (error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      // This is a normal redirect, re-throw it
      throw error
    }
    
    console.log(`❌ Shortlink error: ${code} - ${error.message}`)
    
    // Redirect to non-existent domain to show browser error
    redirect('https://lp.stockstotrade.com/algo-trader')
  }
}
