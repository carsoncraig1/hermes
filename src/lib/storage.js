import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Shared S3-compatible client (works with DigitalOcean Spaces, Cloudflare R2, AWS S3).
// Used for OG images, MMS media (.vcf contact cards), etc.
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

/**
 * Whether cloud storage is configured (bucket + credentials present).
 * @returns {boolean}
 */
export function isStorageConfigured() {
  return Boolean(BUCKET_NAME && process.env.S3_ACCESS_KEY_ID)
}

/**
 * Build the public URL for a stored object key.
 * @param {string} key - Object key (e.g. "vcards/123-abc.vcf")
 * @returns {string}
 */
export function publicUrlForKey(key) {
  return CDN_URL
    ? `${CDN_URL}/${key}`
    : `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`
}

/**
 * Upload a public-read object to S3/Spaces.
 * @param {Object} params
 * @param {Buffer} params.buffer - File contents
 * @param {string} params.key - Object key (path within the bucket)
 * @param {string} params.contentType - MIME type (sent as Content-Type so Telnyx/browsers interpret correctly)
 * @returns {Promise<{ url: string, key: string }>}
 */
export async function uploadPublicFile({ buffer, key, contentType }) {
  if (!isStorageConfigured()) {
    throw new Error('Cloud storage not configured. Please set up S3/Spaces credentials.')
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // Publicly fetchable (required so Telnyx can pull MMS media)
    })
  )

  return { url: publicUrlForKey(key), key }
}

/**
 * Delete an object from S3/Spaces. Best-effort; never throws.
 * @param {string} key - Object key
 * @returns {Promise<boolean>} - true if the delete call succeeded
 */
export async function deletePublicFile(key) {
  if (!isStorageConfigured() || !key) return false
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    return true
  } catch (error) {
    console.error('Error deleting storage object:', error)
    return false
  }
}

export { s3Client, BUCKET_NAME, CDN_URL }
