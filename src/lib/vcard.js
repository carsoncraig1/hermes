/**
 * vCard 3.0 generation (RFC 2426).
 * 3.0 is the most widely interoperable version across iOS and Android.
 */

/**
 * Escape a text value per the vCard spec: backslash, comma, semicolon, and newlines.
 * @param {string} value
 * @returns {string}
 */
function escapeText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/**
 * Fold a content line to 75 octets per RFC, using CRLF + single space continuation.
 * @param {string} line
 * @returns {string}
 */
function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line

  const chars = [...line]
  const out = []
  let current = ''
  let isContinuation = false

  for (const ch of chars) {
    const limit = isContinuation ? 74 : 75 // continuation lines start with a space
    if (Buffer.byteLength(current + ch, 'utf8') > limit) {
      out.push(current)
      current = ch
      isContinuation = true
    } else {
      current += ch
    }
  }
  if (current) out.push(current)

  return out.join('\r\n ')
}

/**
 * Normalize a phone entry into { number, type }.
 */
function normalizePhone(entry) {
  if (!entry) return null
  if (typeof entry === 'string') {
    const number = entry.trim()
    return number ? { number, type: 'CELL' } : null
  }
  const number = String(entry.number || entry.value || '').trim()
  if (!number) return null
  return { number, type: (entry.type || 'CELL').toUpperCase() }
}

/**
 * Normalize an email entry into { address, type }.
 */
function normalizeEmail(entry) {
  if (!entry) return null
  if (typeof entry === 'string') {
    const address = entry.trim()
    return address ? { address, type: 'INTERNET' } : null
  }
  const address = String(entry.address || entry.value || '').trim()
  if (!address) return null
  return { address, type: (entry.type || 'INTERNET').toUpperCase() }
}

/**
 * Derive a display name (FN) from the available fields.
 * @returns {string} - empty string if nothing usable
 */
export function deriveFullName({ firstName, lastName, fullName, org }) {
  if (fullName && fullName.trim()) return fullName.trim()
  const name = [firstName, lastName].map(p => (p || '').trim()).filter(Boolean).join(' ')
  if (name) return name
  if (org && org.trim()) return org.trim()
  return ''
}

/**
 * Build a vCard 3.0 string. FN is required by the spec and is derived if not given.
 *
 * @param {Object} data
 * @param {string} [data.firstName]
 * @param {string} [data.lastName]
 * @param {string} [data.fullName]   - overrides derived FN
 * @param {string} [data.org]
 * @param {string} [data.title]
 * @param {Array<string|{number:string,type?:string}>} [data.phones]
 * @param {Array<string|{address:string,type?:string}>} [data.emails]
 * @param {string} [data.url]
 * @param {string} [data.note]
 * @returns {string} - vCard text with CRLF line endings
 * @throws if no usable name/org is provided (FN cannot be derived)
 */
export function buildVCard(data = {}) {
  const { firstName = '', lastName = '', org = '', title = '', url = '', note = '' } = data
  const fn = deriveFullName(data)
  if (!fn) {
    throw new Error('A name, full name, or organization is required to build a contact card.')
  }

  const phones = (data.phones || []).map(normalizePhone).filter(Boolean)
  const emails = (data.emails || []).map(normalizeEmail).filter(Boolean)

  const lines = ['BEGIN:VCARD', 'VERSION:3.0']

  // N: Family;Given;Additional;Prefix;Suffix
  lines.push(`N:${escapeText(lastName)};${escapeText(firstName)};;;`)
  lines.push(`FN:${escapeText(fn)}`)

  if (org) lines.push(`ORG:${escapeText(org)}`)
  if (title) lines.push(`TITLE:${escapeText(title)}`)

  for (const phone of phones) {
    lines.push(`TEL;TYPE=${escapeText(phone.type)}:${escapeText(phone.number)}`)
  }
  for (const email of emails) {
    lines.push(`EMAIL;TYPE=${escapeText(email.type)}:${escapeText(email.address)}`)
  }

  if (url) lines.push(`URL:${escapeText(url)}`)
  if (note) lines.push(`NOTE:${escapeText(note)}`)

  lines.push('END:VCARD')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/**
 * Build a vCard as a UTF-8 Buffer (ready for upload).
 * @param {Object} data - see buildVCard
 * @returns {Buffer}
 */
export function buildVCardBuffer(data) {
  return Buffer.from(buildVCard(data), 'utf8')
}

/**
 * Cheap structural check that a string looks like a vCard (for validating uploads).
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeVCard(text) {
  if (!text || typeof text !== 'string') return false
  return /BEGIN:VCARD/i.test(text) && /END:VCARD/i.test(text)
}

/**
 * Suggest a default label for a saved card from its structured data.
 * @param {Object} data
 * @returns {string}
 */
export function defaultLabel(data = {}) {
  return deriveFullName(data) || 'Contact card'
}

export const VCARD_CONTENT_TYPE = 'text/vcard'
