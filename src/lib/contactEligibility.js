/**
 * Determine whether a contact is currently eligible to receive outbound messages.
 * This is used as a shared guard across send surfaces.
 * @param {Object} contact
 * @returns {boolean}
 */
export function isContactEligibleForSend(contact) {
  if (!contact) return false;
  if (!contact.phone) return false;
  return contact.subscribed === true;
}

