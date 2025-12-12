import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClickWithHrms, appendHrmsToUrl } from '@/lib/revenue'
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
    // Lookup MessageClickCode by code (5-6 alphanumeric characters)
    // Codes are globally unique, so we can lookup directly
    const messageClickCode = await lookupMessageClickCode(code);
    
    if (!messageClickCode) {
      console.log(`❌ Click code not found: ${code}`)
      redirect('https://lp.stockstotrade.com/algo-trader')
    }
    
    const shortlink = messageClickCode.shortlink;
    
    // Check if shortlink is enabled
    if (!shortlink.enabled) {
      console.log(`❌ Shortlink disabled: ${code}`)
      redirect('https://lp.stockstotrade.com/algo-trader')
    }
    
    // Track opens (bot/preview fetches) vs clicks (real users)
    let hrms = null
    let destinationWithHrms = shortlink.destination
    const messageId = messageClickCode.messageId;
    const contactId = messageClickCode.contactId;
    const messageClickCodeId = messageClickCode.id;
    
    if (isBot) {
      // Bot prefetch = "open" (user saw the preview in their messages)
      // Don't generate HRMS for bot requests
      // Update both the shortlink global counter and the specific MessageClickCode
      await Promise.all([
        prisma.shortlink.update({
          where: { id: shortlink.id },
          data: { opens: { increment: 1 } }
        }),
        // Mark this specific MessageClickCode as opened (first time only)
        !messageClickCode.opened && markCodeAsOpened(code)
      ])
      console.log(`👁️ Open (preview): ${code} → ${shortlink.destination} (${shortlink.opens + 1} opens) [contactId: ${contactId}, messageId: ${messageId}] [${userAgent.substring(0, 50)}...]`)
    } else {
      // Real user click - we have full message-level tracking!
      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
      const referrer = request.headers.get('referer') || null
      
      // Mark code as clicked (first time only)
      if (!messageClickCode.clicked) {
        await markCodeAsClicked(code);
      }
      
      // Generate unique HRMS for this specific click
      hrms = await createClickWithHrms(
        shortlink.id,
        messageId,
        contactId,
        messageClickCodeId,
        userAgent,
        ipAddress,
        referrer
      );
      destinationWithHrms = appendHrmsToUrl(shortlink.destination, hrms)
      
      // Increment click counter
      await prisma.shortlink.update({
        where: { id: shortlink.id },
        data: { clicks: { increment: 1 } }
      })
      console.log(`✅ Click: ${code} → ${destinationWithHrms} (${shortlink.clicks + 1} clicks) [messageId: ${messageId}, contactId: ${contactId}, hrms: ${hrms}]`)
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
