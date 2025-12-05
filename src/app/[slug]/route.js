import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

function generateOgHtml(shortlink) {
  const { destination, ogImage, ogTitle, ogDescription, slug } = shortlink
  const shortUrl = `https://txt.cx/${slug}`
  
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
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  ${ogTitle ? `<meta name="twitter:title" content="${ogTitle}">` : ''}
  ${ogDescription ? `<meta name="twitter:description" content="${ogDescription}">` : ''}
  ${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ''}
  
  <!-- Redirect after a brief delay for crawlers to parse OG tags -->
  <meta http-equiv="refresh" content="0;url=${destination}">
  
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
    <p><a href="${destination}">Click here if not redirected</a></p>
  </div>
  <script>
    window.location.href = "${destination}";
  </script>
</body>
</html>`
}

export async function GET(request, { params }) {
  const { slug } = params
  const userAgent = request.headers.get('user-agent') || ''
  const isBot = isBotRequest(userAgent)
  
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
      
      // Track opens (bot/preview fetches) vs clicks (real users)
      if (isBot) {
        // Bot prefetch = "open" (user saw the preview in their messages)
        await prisma.shortlink.update({
          where: { id: shortlink.id },
          data: { opens: { increment: 1 } }
        })
        console.log(`👁️ Open (preview): ${slug} → ${shortlink.destination} (${shortlink.opens + 1} opens) [${userAgent.substring(0, 50)}...]`)
      } else {
        // Real user click
        await prisma.shortlink.update({
          where: { id: shortlink.id },
          data: { clicks: { increment: 1 } }
        })
        console.log(`✅ Click: ${slug} → ${shortlink.destination} (${shortlink.clicks + 1} clicks)`)
      }
      
      // If OG preview is enabled, serve HTML with OG meta tags
      if (shortlink.ogEnabled && shortlink.ogImage) {
        const html = generateOgHtml(shortlink)
        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html',
          },
        })
      }
      
      // Otherwise, redirect directly to the destination URL
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
