import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClickWithHrms, appendHrmsToUrl, generateHrms } from '@/lib/revenue'
import { lookupMessageClickCode, markCodeAsClicked, markCodeAsOpened } from '@/lib/messageClickCodes'
import {
  expandShortlinkDestinationMacros,
  destinationTemplateUsesMacros,
  destinationHasUnresolvedMacroSyntax,
} from '@/lib/shortlinkDestinationMacros'

// Bot/crawler User-Agent patterns for link preview fetching
const BOT_PATTERNS = [
  'facebookexternalhit',   // Facebook, Instagram, Messenger
  'Facebot',               // Facebook
  'Twitterbot',            // Twitter/X
  // NOTE: Do not match plain "WhatsApp" — WhatsApp in-app WebView UAs contain that string, so real
  // taps were misclassified as bots and destination URL macros were skipped.
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

// Paths and patterns that should NOT log "code not found" (browser assets, known routes, scanner probes)
const KNOWN_PATHS = new Set([
  'robots.txt', 'sitemap.xml', 'sitemap.txt', 'sitemaps.xml',
  'hermes', 'api', 'favicon.ico', 'favicon.png', 'favicon.svg',
  'apple-touch-icon.png', 'apple-touch-icon-precomposed.png',
])
const SCANNER_PATTERNS = [
  /\.php$/i,           // WordPress/vulnerability scanners
  /^wp-/,              // wp-login.php, wp-admin.php, etc.
  /^(admin|config|install|setup|test)\d*\.php$/i,
  /\.(env|bak|log|sql|zip)$/i,
  /^(xmlrpc|atomlib|inputs|ioxi|rip|wso|alfa|shell|class-t\.api)\.php$/i,
  /^(image|doc|mar|about|ws|content|cache|load|edit|file|wp-content)$/i, // Common scanner path fragments
]
function shouldSuppressNotFoundLog(code) {
  if (!code || typeof code !== 'string') return true
  const lower = code.toLowerCase()
  if (KNOWN_PATHS.has(lower)) return true
  if (SCANNER_PATTERNS.some(p => p.test(code))) return true
  return false
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
    let shortlink = null
    let messageClickCode = null
    const isLegacySlug = code.length === 3
    
    // Simple logic: 3 characters = legacy slug, anything else = dynamic
    if (code.length === 3) {
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
        // Not found - hit fallback (suppress log for known paths and scanner/browser noise)
        if (!shouldSuppressNotFoundLog(code)) {
          console.log(`❌ Legacy shortlink not found: ${code}`)
        }
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
      
      // Check if enabled
      if (!shortlink.enabled) {
        console.log(`❌ Legacy shortlink disabled: ${code}`)
        redirect('https://lp.stockstotrade.com/algo-trader')
      }
    } else {
      // Dynamic shortlink: lookup MessageClickCode by code (5-6 alphanumeric characters)
      messageClickCode = await lookupMessageClickCode(code);
      
      if (!messageClickCode) {
        // Not found - hit fallback (suppress log for known paths and scanner/browser noise)
        if (!shouldSuppressNotFoundLog(code)) {
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

      const dest = shortlink.destination || ''
      const uaSnippet = userAgent.replace(/\s+/g, ' ').slice(0, 160)
      console.log(
        `[shortlink-dynamic] hit code=${code} shortlinkId=${shortlink.id} nickname=${shortlink.nickname || ''} isBot=${isBot} contactId=${messageClickCode.contactId ?? 'none'} destLen=${dest.length} destHasDoubleBrace=${dest.includes('{{')} destUsesMacroSyntax=${destinationTemplateUsesMacros(dest)} uaSnippet=${JSON.stringify(uaSnippet)} destPreview=${JSON.stringify(dest.slice(0, 180))}`
      )
    }
    
    // Track opens (bot/preview fetches) vs clicks (real users)
    let hrms = null
    let destinationWithHrms = shortlink.destination
    
    if (code.length === 3) {
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
          
          // Create click record (no HRMS for legacy shortlinks)
          await tx.shortlinkClick.create({
            data: {
              shortlinkId: shortlink.id,
              hrms: null, // Legacy shortlinks don't use HRMS
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
        console.log(
          `[shortlink-dynamic] botOrPreview path code=${code} — URL macros are not expanded here (preview privacy); final redirect target still has raw template if dest had {{placeholders}}`
        )
      } else {
        // Real user click - we have full message-level tracking!
        // Use atomic transaction to ensure one click per code, prevent race conditions
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
        const referrer = request.headers.get('referer') || null

        let macroContact = null
        if (contactId) {
          macroContact = await prisma.contact.findFirst({
            where: { id: contactId, userId: shortlink.userId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              source: true,
              age: true,
            },
          })
        }

        if (contactId && !macroContact) {
          console.log(
            `[shortlink-dynamic] macroContact NOT loaded code=${code} contactId=${contactId} shortlinkOwnerUserId=${shortlink.userId} (contact missing or userId mismatch)`
          )
        }

        // Atomic transaction: check if clicked, mark as clicked, increment counter, create record - all or nothing
        const clickResult = await prisma.$transaction(async (tx) => {
          // Re-fetch the messageClickCode within transaction to get latest state
          const currentCode = await tx.messageClickCode.findUnique({
            where: { code },
            select: { clicked: true, id: true, contactId: true }
          })
          
          // If already clicked, return early - don't count this as a click
          if (!currentCode || currentCode.clicked) {
            return { isNewClick: false, hrms: null, contactId: currentCode?.contactId || null }
          }
          
          // Mark as clicked (atomic update)
          await tx.messageClickCode.update({
            where: { code },
            data: {
              clicked: true,
              clickedAt: new Date()
            }
          })
          
          // Update contact's hasClicked field if contactId exists
          if (currentCode.contactId) {
            await tx.contact.update({
              where: { id: currentCode.contactId },
              data: { hasClicked: true }
            }).catch(err => {
              // Don't fail the transaction if contact update fails
              console.error('Error updating contact hasClicked:', err);
            });
          }
          
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
          
          return { isNewClick: true, hrms, contactId: currentCode.contactId }
        })
        
        const baseDestination = expandShortlinkDestinationMacros(
          shortlink.destination,
          macroContact,
          { expand: true }
        )

        console.log(
          `[shortlink-dynamic] humanClick expand code=${code} contactLoaded=${Boolean(macroContact)} newClick=${clickResult.isNewClick} unresolvedAfterExpand=${destinationHasUnresolvedMacroSyntax(baseDestination)} basePreview=${JSON.stringify(baseDestination.slice(0, 200))}`
        )

        // Only proceed if this was a new click
        if (clickResult.isNewClick && clickResult.hrms) {
          hrms = clickResult.hrms
          destinationWithHrms = appendHrmsToUrl(baseDestination, hrms)
          
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
          destinationWithHrms = baseDestination
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
