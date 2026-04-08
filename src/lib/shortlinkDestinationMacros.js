/**
 * Allowlisted {{key}} placeholders for dynamic shortlink destination URLs.
 * Expanded at redirect time from the contact tied to the click code.
 */
const MACRO_KEY_ALLOWLIST = new Set([
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'source',
  'age',
  'id',
]);

const MACRO_REGEX = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

function fullNameFromContact(contact) {
  if (!contact) return '';
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.join(' ').trim();
}

/**
 * @param {string} key
 * @param {object|null|undefined} contact
 * @returns {string|null} value to encode, or null if key is not allowlisted
 */
function valueForMacroKey(key, contact) {
  if (!MACRO_KEY_ALLOWLIST.has(key)) {
    return null;
  }
  if (!contact) {
    return '';
  }
  switch (key) {
    case 'firstName':
      return contact.firstName ?? '';
    case 'lastName':
      return contact.lastName ?? '';
    case 'fullName':
      return fullNameFromContact(contact);
    case 'email':
      return contact.email ?? '';
    case 'phone':
      return contact.phone ?? '';
    case 'source':
      return contact.source ?? '';
    case 'age':
      return contact.age ?? '';
    case 'id':
      return contact.id != null ? String(contact.id) : '';
    default:
      return '';
  }
}

/**
 * Replace allowlisted {{field}} tokens in a destination URL template.
 * Values are passed through encodeURIComponent for safe use in paths and query strings.
 *
 * @param {string} destination
 * @param {object|null|undefined} contact
 * @param {{ expand?: boolean }} [options]
 * @returns {string}
 */
export function expandShortlinkDestinationMacros(destination, contact, options = {}) {
  const { expand = true } = options;
  if (!expand || destination == null || destination === '') {
    return destination;
  }

  return destination.replace(MACRO_REGEX, (full, key) => {
    const raw = valueForMacroKey(key, contact);
    if (raw === null) {
      return full;
    }
    return encodeURIComponent(raw);
  });
}

export { MACRO_KEY_ALLOWLIST };
