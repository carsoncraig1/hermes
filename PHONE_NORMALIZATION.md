# Phone normalization

## Decision

Hermes stores operational contact and sender phone numbers in canonical international
E.164 format: `+<country calling code><national number>`. The country code is not
hardcoded to `1`.

The shared implementation is `normalizePhoneNumber` in `src/lib/phoneUtils.js`.
Contact API intake, manual contact creation/editing, CSV imports, sender settings,
Telnyx delivery, inbound STOP matching, conversation grouping, and phone identity
in shortlink redirects use this implementation rather than separate normalization rules.

## Accepted input

- International numbers must include `+` and their country calling code:
  `+44 20 7946 0958` becomes `+442079460958`.
- Bare 10-digit numbers retain the existing North American Numbering Plan default:
  `(202) 555-0123` becomes `+12025550123`.
- Eleven digits beginning with `1` are also accepted: `12025550123` becomes
  `+12025550123`.
- Surrounding whitespace, spaces, parentheses, dots, and dashes are accepted.
- Extensions, letters, misplaced or repeated `+`, unrecognized country calling codes,
  and impossible phone-number lengths are rejected. Other international numbers
  without `+` are rejected rather than guessing a country.
- `libphonenumber-js` calling-code and possible-length metadata is used. This is not
  verification of ownership, allocation, reachability, SMS capability, or Telnyx routing.
- Explicit international input takes precedence over the domestic default. For example,
  `+65 6123 4567` becomes `+6561234567`, never `+16561234567`.
- National digits are preserved according to the country's numbering plan; a significant
  Italian leading zero is not removed.

Required contact phones cannot be cleared or replaced with invalid input. Partial
server-action updates may omit `phone` without changing it. Optional legacy sender
settings can explicitly clear the number with `null` or a blank string; omitting the
field preserves it. Invalid CSV rows are reported using their original row numbers
while valid rows continue through the import.

## Link and hash contract

Recipient-specific human clicks automatically receive both identity parameters when
the recipient has a normalizable phone. No destination URL tokens are needed.
The SMS contains the recipient-specific short URL. Hermes adds identity to the
destination URL at click time, including repeat clicks and navigation through
recipient OG pages; it does not append these query parameters to the SMS body itself.

- `phone`: canonical E.164 with the leading `+` removed.
- `phone_hash`: unsalted SHA-256 of the exact `phone` string, encoded as lowercase hex.

For stored `+442079460958`, the URL carries `phone=442079460958` and
`phone_hash=sha256("442079460958")`. For a domestic stored number, the hash still
includes country code `1`. There is no `+`, punctuation, or salt in the hash input.
The raw phone parameter is unhashed personal data, not the original formatted input.

Missing or invalid phone input contributes neither parameter. Bot previews and
generic legacy shortlinks do not receive recipient identity. First and repeat
recipient clicks follow the same normalization rule.

## Existing data and enforcement

Normalization is enforced at the application's intake boundaries, before phone
matching and persistence. Database triggers provide a second boundary on
`contacts.phone`, `phone_numbers.phoneNumber`, and `users.telnyxPhoneNumber`:
new inserts and changed phone values must have `+` followed by 2–15 digits with a
nonzero first digit. The optional user sender setting may be `NULL`, not an empty
string. This storage-format guard also protects writes that bypass application code;
calling-code recognition and possible-length validation remain in the shared
application normalizer.

The triggers are defined in `prisma/migrations/enforce_canonical_phone_format.sql`.
Historical invalid values may remain unchanged, including during unrelated updates,
so subscription and delivery-state updates are not blocked. Changing a historical
phone to another malformed value is rejected. The guards do not merge contacts or
establish uniqueness by `(userId, phone)`.

Audit existing contact records without modifying them:

```sh
node --env-file=.env scripts/normalize-contact-phones.mjs
```

The report counts canonical, normalizable, and invalid records, and groups that resolve
to the same canonical phone within an account. Inspect these findings before applying
a backfill during maintenance. Install the idempotent database guards before the pass
to prevent new malformed-format writes racing with the cleanup:

```sh
node --env-file=.env scripts/normalize-contact-phones.mjs --apply --enforce
```

The backfill updates normalizable phone values only. It preserves contact IDs and
relationships, never merges or deletes contacts, and leaves invalid records unchanged
for explicit review. Each update checks the original phone value so a concurrent edit
is not overwritten. Canonical duplicates remain separate records; this command does
not establish a uniqueness constraint. Historical invalid numbers must be corrected
from a reliable source, not assigned a guessed country code.

The `--enforce` flag requires `--apply`; audit mode never changes schema or data.
Guard installation is atomic and uses a five-second lock timeout rather than waiting
indefinitely for table locks. Sender-number records and legacy sender settings should
also be audited; the contact backfill does not rewrite sender numbers or historical
message snapshots.

The separate `scripts/deduplicate-contacts.js` also uses the shared normalizer, but it
is destructive and must not be substituted for this non-destructive backfill without
explicit approval.
