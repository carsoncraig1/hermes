/**
 * One-Click Open (OCO) webinar join URLs for use as dynamic shortlink destinations.
 * Query values use Hermes {{macro}} tokens; expandShortlinkDestinationMacros expands them at click time.
 */

export const OCO_BASE = 'https://oco.txt.cx/join';

const HERMES_OCO_MACROS = {
  fn: '{{firstName}}',
  ln: '{{lastName}}',
  email: '{{email}}',
  ph: '{{phone}}',
};

/**
 * @param {string} input
 * @returns {string} digits only
 */
export function normalizeWebinarId(input) {
  if (input == null || input === '') return '';
  return String(input).replace(/\D/g, '');
}

/**
 * @param {string} webinarId raw or partial ID (normalized before use)
 * @returns {string|null} full OCO URL, or null if no digits in webinarId
 */
export function generateOCOLink(webinarId) {
  const id = normalizeWebinarId(webinarId);
  if (!id) return null;

  const params = new URLSearchParams({
    webinar_id: id,
    fn: HERMES_OCO_MACROS.fn,
    ln: HERMES_OCO_MACROS.ln,
    email: HERMES_OCO_MACROS.email,
    ph: HERMES_OCO_MACROS.ph,
  });

  return `${OCO_BASE}?${decodeURIComponent(params.toString())}`;
}
