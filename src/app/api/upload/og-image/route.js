import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/lib/auth'

// S3-compatible client (works with DigitalOcean Spaces, Cloudflare R2, AWS S3)
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT, // e.g., https://nyc3.digitaloceanspaces.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false, // Required for DigitalOcean Spaces
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME
const CDN_URL = process.env.S3_CDN_URL // e.g., https://your-space.nyc3.cdn.digitaloceanspaces.com

export async function POST(request) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if S3 is configured
    if (!BUCKET_NAME || !process.env.S3_ACCESS_KEY_ID) {
      return NextResponse.json({ 
        error: 'Cloud storage not configured. Please set up S3/Spaces credentials.' 
      }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
    }

    // Generate unique filename
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const filename = `og-images/${timestamp}-${randomStr}.${ext}`

    // Upload to S3/Spaces
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read', // Make the file publicly accessible
    })

    await s3Client.send(command)

    // Return the public URL
    const url = CDN_URL 
      ? `${CDN_URL}/${filename}`
      : `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${filename}`

    return NextResponse.json({ 
      success: true, 
      url,
      filename 
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
