# Cursor Agent Prompt: Sending Throughput Optimization + Revolver Multi-Number System

You are making changes to an SMS platform called Hermes built on Next.js 14 (App Router) + PostgreSQL (Prisma ORM) that sends messages via Telnyx API. The app is hosted at txt.cx.

This prompt covers TWO major initiatives:
1. **Sending throughput optimization** — batch DB writes to eliminate per-message overhead and hit 1200 MPM per number
2. **Revolver system** — multi-number load balancing with per-number rate limiting, opt-in assignment, and settings UI

---

## PART 1: SENDING THROUGHPUT OPTIMIZATION

### Problem
Each message currently requires 5-6 sequential DB round trips inside `sendMessage()` in `src/lib/telnyx.js`:
1. `prisma.contact.findUnique` (subscription check)
2. `prisma.message.create` (create record BEFORE sending)
3. `prisma.shortlink.findMany` + `prisma.messageClickCode.createMany` (click code creation inside `createMessageClickCodes`)
4. `telnyx.messages.create()` (the actual HTTP call to Telnyx — this one is unavoidable)
5. `prisma.message.update` (update with telnyxMessageId, status, cost)
6. `prisma.contact.update` (update lastMessageSent)

At BATCH_SIZE=20, that's 100-120 DB round trips per batch (each ~2-5ms), adding 200-600ms of pure DB overhead per batch on top of the Telnyx HTTP calls. This makes it impossible to hit 1200 MPM.

### Solution: Batch DB writes in `executeDedicatedSend()`

The key insight is that `executeDedicatedSend()` in `src/lib/actions/campaigns.js` (around line 1092) already has access to the full batch of contacts before sending. We can restructure the send loop to do DB operations in bulk before and after the Telnyx calls, rather than per-message inside `sendMessage()`.

#### Step 1: Create a new `sendMessageBulkOptimized()` function in `src/lib/telnyx.js`

Create a new export called `sendMessageBulkOptimized` that accepts an array of prepared message objects and ONLY does the Telnyx HTTP call + returns the result. It should NOT do any DB operations. The signature should be:

```js
export async function sendMessageBulkOptimized({
  telnyxClient,
  from,
  to,           // single normalized E.164 number
  text,         // already has click codes embedded
  messagingProfileId,
}) {
  // ONLY the Telnyx API call - no DB reads or writes
  const response = await telnyxClient.messages.create({
    from,
    to: [to],
    text,
    type: 'SMS',
    messaging_profile_id: messagingProfileId,
    webhook_url: 'https://txt.cx/api/message/status',
    webhook_failover_url: '',
  });

  return {
    success: true,
    telnyxMessageId: response.data?.id,
    initialStatus: response.data?.to?.[0]?.status || response.data?.status || 'queued',
    costAmount: response.data?.cost?.amount || null,
    costCurrency: response.data?.cost?.currency || 'USD',
    rawData: response.data,
  };
}
```

Do NOT remove or modify the existing `sendMessage()` function — it's still used for single-message sends (workflow executor, manual sends, etc.). The new function is specifically for the bulk send path.

#### Step 2: Restructure `executeDedicatedSend()` batch loop

In `src/lib/actions/campaigns.js`, inside the `for` loop that processes each batch (around line 1257), replace the current `Promise.allSettled(batch.map(contact => retryWithBackoff(() => sendMessage(...))))` pattern with this new 4-phase batch approach:

**Phase 1: Pre-create Message records in bulk (single DB call)**
Before calling Telnyx for any message in the batch, use `prisma.message.createMany()` to insert all Message records at once with `status: 'queued'`. Each record needs a pre-generated `id` (use `cuid()` from `@paralleldrive/cuid2` or Prisma's default — but since we need the IDs, generate them with `crypto.randomUUID()` or import `createId` from `@paralleldrive/cuid2`). Store the mapping of `contactId → messageId` in a Map.

```js
import { createId } from '@paralleldrive/cuid2';

// Generate IDs and build records
const messageRecords = batch.map(contact => {
  const messageId = createId();
  return {
    id: messageId,
    userId,
    contactId: contact.id,
    campaignId: campaignIdInt,
    from: telnyxConfig.phoneNumber, // will change in Part 2 for revolver
    to: contact.phone,
    text: messageText, // will be updated with click codes
    type: 'SMS',
    parts: 1, // recalculate with validateMessage if needed
    status: 'queued',
    direction: 'outbound',
  };
});

// Single DB call for entire batch
await prisma.message.createMany({ data: messageRecords });

// Build lookup map
const contactToMessageId = new Map();
messageRecords.forEach(rec => {
  contactToMessageId.set(rec.contactId, rec.id);
});
```

**Phase 2: Batch-create MessageClickCodes (single DB call)**
If the message text contains shortlink markers (`{{SHORTLINK:ID}}` or `txt.cx/shortlink-ID`), pre-generate all click codes for all contacts in the batch at once. Currently `createMessageClickCodes()` in `src/lib/messageClickCodes.js` is called per-message inside `sendMessage()`. Instead:

- Call `extractShortlinksFromText(messageText)` once for the batch (all contacts get the same shortlinks, just different codes).
- For each contact × shortlink combination, generate a unique 6-char base62 code using `generateUniqueClickCode()`.
- Use a single `prisma.messageClickCode.createMany()` for the entire batch.
- Build a Map of `contactId → modifiedText` (with the per-contact unique click code URLs embedded).

Create a new helper function `createMessageClickCodesBatch(messageText, contactMessageIdMap, userId)` in `src/lib/messageClickCodes.js` that does this:

```js
export async function createMessageClickCodesBatch(messageText, contactMessagePairs, userId) {
  // contactMessagePairs: Array<{ contactId, messageId }>
  if (!messageText) return new Map();

  const shortlinkRefs = extractShortlinksFromText(messageText);
  if (shortlinkRefs.length === 0) return new Map(); // all contacts get same unmodified text

  // Verify shortlinks belong to user (single query)
  const shortlinkIds = [...new Set(shortlinkRefs.map(s => s.shortlinkId))];
  const validShortlinks = await prisma.shortlink.findMany({
    where: { userId, id: { in: shortlinkIds } },
    select: { id: true }
  });
  const validIds = new Set(validShortlinks.map(s => s.id));
  const validRefs = shortlinkRefs.filter(ref => validIds.has(ref.shortlinkId));
  if (validRefs.length === 0) return new Map();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Generate ALL codes at once (contacts × shortlinks)
  const totalCodes = contactMessagePairs.length * validRefs.length;
  const allCodes = await Promise.all(
    Array.from({ length: totalCodes }, () => generateUniqueClickCode())
  );

  // Build createMany data and per-contact text map
  const codeData = [];
  const contactTextMap = new Map(); // contactId → modified text
  let codeIndex = 0;

  for (const { contactId, messageId } of contactMessagePairs) {
    let modifiedText = messageText;
    // Process in reverse order to preserve string indices
    for (let i = validRefs.length - 1; i >= 0; i--) {
      const ref = validRefs[i];
      const code = allCodes[codeIndex + i];
      codeData.push({
        code,
        shortlinkId: ref.shortlinkId,
        messageId,
        contactId,
        userId,
        expiresAt,
      });
      const newUrl = `https://txt.cx/${code}`;
      modifiedText = modifiedText.substring(0, ref.index) + newUrl + modifiedText.substring(ref.index + ref.fullUrl.length);
    }
    contactTextMap.set(contactId, modifiedText);
    codeIndex += validRefs.length;
  }

  // Single bulk insert
  await prisma.messageClickCode.createMany({ data: codeData, skipDuplicates: true });

  return contactTextMap; // Map<contactId, modifiedTextWithCodes>
}
```

**Phase 3: Fire all Telnyx HTTP calls in parallel**
Use `Promise.allSettled` with `retryWithBackoff` to call `sendMessageBulkOptimized()` for each contact in the batch. Pass the per-contact modified text (from the contactTextMap, or the base messageText if no shortlinks):

```js
const results = await Promise.allSettled(
  batch.map(contact => {
    const textForContact = contactTextMap.get(contact.id) || messageText;
    return retryWithBackoff(
      () => sendMessageBulkOptimized({
        telnyxClient: telnyxConfig.client,
        from: telnyxConfig.phoneNumber,
        to: normalizePhoneForTelnyx(contact.phone),
        text: textForContact,
        messagingProfileId: telnyxConfig.messagingProfileId,
      }),
      { maxRetries: 3, initialDelay: 1000, shouldRetry: isRetryableError }
    );
  })
);
```

Note: You'll need to import `normalizePhoneForTelnyx` from `src/lib/telnyx.js`. It's currently not exported — **export it**.

**Phase 4: Batch-update Message records and Contact records after Telnyx calls (2 DB calls total)**
After all Telnyx calls complete, update all Message records in bulk:

- For successful sends: update `telnyxMessageId`, `status`, `costAmount`, `sentAt`, and `text` (with click code text).
- For failed sends: update `status` to `'sending_failed'`, `failedAt`, `errorMessage`.

Since Prisma doesn't support `updateMany` with different values per row, use a raw SQL query with a `CASE` statement or use individual `prisma.message.update()` calls wrapped in a `prisma.$transaction()`:

```js
// Collect updates
const messageUpdates = [];
const contactUpdates = []; // contactIds to update lastMessageSent
const now = new Date();

results.forEach((result, index) => {
  const contact = batch[index];
  const messageId = contactToMessageId.get(contact.id);
  const textForContact = contactTextMap.get(contact.id) || messageText;

  if (result.status === 'fulfilled' && result.value.success) {
    const r = result.value;
    messageUpdates.push(
      prisma.message.update({
        where: { id: messageId },
        data: {
          telnyxMessageId: r.telnyxMessageId,
          status: r.initialStatus,
          costAmount: (r.initialStatus === 'sent' || r.initialStatus === 'delivered' || r.initialStatus === 'delivery_unconfirmed') && r.costAmount ? parseFloat(r.costAmount) : null,
          costCurrency: r.costCurrency,
          sentAt: (r.initialStatus === 'sent' || r.initialStatus === 'sending') ? now : null,
          text: textForContact,
          telnyxMetadata: r.rawData ? JSON.parse(JSON.stringify(r.rawData)) : null,
        }
      })
    );
    contactUpdates.push(contact.id);
  } else {
    const errorMsg = result.status === 'rejected'
      ? result.reason?.message || 'Unknown error'
      : result.value?.error || 'Send failed';
    messageUpdates.push(
      prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'sending_failed',
          failedAt: now,
          errorMessage: errorMsg,
        }
      })
    );
  }
});

// Execute all message updates + contact batch update in a single transaction
await prisma.$transaction([
  ...messageUpdates,
  // Batch update lastMessageSent for all successful contacts
  ...(contactUpdates.length > 0 ? [
    prisma.contact.updateMany({
      where: { id: { in: contactUpdates } },
      data: { lastMessageSent: now }
    })
  ] : [])
]);
```

#### Step 3: Increase BATCH_SIZE

Change `BATCH_SIZE` from 20 to 50 in `executeDedicatedSend()`. With the DB overhead moved to batch operations, the bottleneck is now the Telnyx HTTP calls (~50-100ms each). 50 parallel HTTP calls should complete in ~200ms, keeping us well within the 1200 MPM budget (50 messages per ~1.5s cycle ≈ 2000 MPM theoretical max per number).

Also update the delay calculation: change `minBatchTime` from 1000ms to `Math.ceil((batch.length / 1200) * 60000)` to dynamically calculate the minimum batch time based on the rate limit.

#### Step 4: Fix workflow executor redundancies

In `src/lib/workflow/executor.js`, the `sendMessage()` function (around line 24) does TWO unnecessary DB queries per message:

1. **Line ~41**: `prisma.user.findUnique({ where: { id: userId }, select: { standardOptOutText: true } })` — This fetches the user's opt-out text for EVERY SINGLE message, even though it's the same for all messages in a workflow execution.

2. **Line ~63-69**: `prisma.campaign.update({ where: { id: campaignId }, data: { messagesSent: { increment: 1 }, lastMessageSent: new Date() } })` — This increments the campaign's messagesSent counter one-by-one for every message.

**Fix #1**: Add an `optOutText` parameter to the `sendMessage()` function in `executor.js`. Then in `executeWorkflow()` (around line 411), fetch the optOutText ONCE before the DAG traversal begins and pass it down through the node execution chain. Specifically:

- In `executeWorkflow()`, after resolving the userId, add:
  ```js
  const userSettings = await prisma.user.findUnique({
    where: { id: userId },
    select: { standardOptOutText: true }
  });
  const optOutText = userSettings?.standardOptOutText || null;
  ```
- Pass `optOutText` as a parameter through `executeNode()` and into `sendMessage()`.
- In `sendMessage()`, use the passed `optOutText` instead of querying the DB.

**Fix #2**: Remove the per-message `prisma.campaign.update({ messagesSent: { increment: 1 } })` from the executor's `sendMessage()`. Instead, track the count in the calling function (`executeManualFire()` in `campaigns.js`) and do a single `prisma.campaign.update({ messagesSent: { increment: totalSuccessCount } })` after the batch completes, exactly like `executeDedicatedSend()` already does (around line 1327).

**Important**: The executor's `sendMessage()` function is different from the telnyx.js `sendMessage()`. The executor's version (in `src/lib/workflow/executor.js` line 24) is a wrapper that adds opt-out text and campaign stats, then calls the telnyx.js `sendMessage()`. Make sure you're editing the right one.

---

## PART 2: REVOLVER MULTI-NUMBER SYSTEM

### Overview
The "revolver" system load-balances SMS sending across multiple toll-free phone numbers. Each contact is permanently assigned to one phone number at opt-in time. During sends, contacts are grouped by their assigned phone number, and each number gets its own parallel send stream with independent rate limiting. This lets you go beyond the 1200 MPM limit of a single number (e.g., 5 numbers = 6000 MPM theoretical max).

### Step 1: New Prisma model — `PhoneNumber`

Add this model to `prisma/schema.prisma`:

```prisma
model PhoneNumber {
  id                    Int       @id @default(autoincrement())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  phoneNumber           String    // E.164 format (+1XXXXXXXXXX)
  friendlyName          String?   // Optional display name (e.g., "TF #1", "Main Line")
  type                  String    @default("toll_free") // toll_free, local, short_code
  messagingProfileId    String?   // Telnyx messaging profile ID for this number
  enabled               Boolean   @default(true) // Whether this number can send messages at all
  acceptingNewLeads     Boolean   @default(true) // Whether new opt-ins get assigned to this number
  rateLimit             Int       @default(1200) // Messages per minute limit for this number
  currentMonthMessages  Int       @default(0) // Approximate message count this month (reset monthly)

  // Relations
  contacts              Contact[] // Contacts assigned to this number

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([userId, phoneNumber]) // One entry per number per user
  @@index([userId, enabled])
  @@index([userId, acceptingNewLeads])
  @@map("phone_numbers")
}
```

### Step 2: Add `assignedPhoneNumberId` to Contact model

Add a new optional field to the `Contact` model:

```prisma
model Contact {
  // ... existing fields ...
  assignedPhoneNumberId Int?
  assignedPhoneNumber   PhoneNumber? @relation(fields: [assignedPhoneNumberId], references: [id], onDelete: SetNull)
  // ... rest of fields ...
}
```

This is nullable because existing contacts won't have an assignment yet. The system must handle contacts with `assignedPhoneNumberId = null` gracefully — these should use the user's legacy `telnyxPhoneNumber` from the User model as a fallback.

### Step 3: Add `phoneNumbers` relation to User model

Add to the User model in schema.prisma:

```prisma
model User {
  // ... existing fields ...
  phoneNumbers  PhoneNumber[]
  // ... rest of fields ...
}
```

### Step 4: Run migration

After schema changes, create and apply a migration:
```
npx prisma migrate dev --name add-phone-number-revolver
```

### Step 5: Phone number assignment on opt-in

In `src/app/api/contact/route.js`, the POST handler (starting around line 103) handles new lead opt-ins. After creating or finding a contact, assign them to a phone number using a **least-loaded** strategy.

Add this logic AFTER the contact is created/found but BEFORE triggering workflows:

```js
// === REVOLVER: Assign phone number to new contact ===
// Only assign if contact doesn't already have one
if (!existingContact?.assignedPhoneNumberId) {
  try {
    // Get all phone numbers that are enabled AND accepting new leads for this user
    const availableNumbers = await prisma.phoneNumber.findMany({
      where: {
        userId: userId,
        enabled: true,
        acceptingNewLeads: true,
      },
      select: {
        id: true,
        phoneNumber: true,
        _count: { select: { contacts: true } }, // count of assigned contacts
      },
      orderBy: { createdAt: 'asc' }, // deterministic ordering for tie-breaking
    });

    if (availableNumbers.length > 0) {
      // Pick the number with the fewest assigned contacts (least-loaded)
      const leastLoaded = availableNumbers.reduce((min, num) =>
        num._count.contacts < min._count.contacts ? num : min
      );

      // Assign to contact
      await prisma.contact.update({
        where: { id: contact.id },
        data: { assignedPhoneNumberId: leastLoaded.id }
      });
    }
    // If no available numbers, contact remains unassigned (will use legacy User.telnyxPhoneNumber)
  } catch (assignError) {
    console.error('Error assigning phone number to contact:', assignError);
    // Non-fatal: continue even if assignment fails
  }
}
```

This runs for BOTH new contacts and existing contacts that don't have an assignment yet (e.g., contacts that were created before the revolver system was set up).

### Step 6: Update `executeDedicatedSend()` to group by phone number

This is the core change for parallel multi-number sending. In `src/lib/actions/campaigns.js`, inside `executeDedicatedSend()`:

**Before the batch processing loop**, after fetching the first page of contacts, add logic to:

1. Fetch all PhoneNumber records for the user (single query).
2. Build a `phoneNumberMap`: `Map<phoneNumberId, { phoneNumber, messagingProfileId, rateLimit, telnyxClient }>`. All numbers share the same Telnyx API key (from the User model), so they all use the same `telnyxConfig.client`. The `from` number and `messagingProfileId` differ per PhoneNumber record.
3. Add a fallback entry for contacts with `assignedPhoneNumberId = null` using the user's legacy `telnyxPhoneNumber` and `telnyxMessagingProfileId`.

**In the batch processing loop**, group contacts by `assignedPhoneNumberId`:

```js
// Group batch contacts by their assigned phone number
const groupedByNumber = new Map(); // phoneNumberId (or 'legacy') → contacts[]

for (const contact of batch) {
  const key = contact.assignedPhoneNumberId || 'legacy';
  if (!groupedByNumber.has(key)) {
    groupedByNumber.set(key, []);
  }
  groupedByNumber.get(key).push(contact);
}
```

Then, for each group, run the 4-phase batch process (pre-create messages, create click codes, fire Telnyx calls, batch-update) using the correct `from` number and `messagingProfileId` for that phone number group. All groups execute in parallel using `Promise.allSettled`.

**Important**: You'll need to fetch the `assignedPhoneNumberId` when loading contacts. In `getCampaignContactsPaginated()` (imported from `src/lib/contactPagination.js`), make sure the `select` includes `assignedPhoneNumberId`. Check the function and add it to the select clause if it's not already there.

**Per-number rate limiting**: Each phone number group should respect its own rate limit. Use the `rateLimit` field from the PhoneNumber record. The delay between batches should be calculated per-number-group, not globally. For the simplest implementation, calculate the delay as:
```js
const perNumberMinBatchTime = Math.ceil((groupSize / phoneNumberConfig.rateLimit) * 60000);
```

### Step 7: Update inbound STOP handler for multi-number support

In `src/app/api/message/inbound.js`, the current STOP handler (line ~91) looks up the user by matching the `to` number against `User.telnyxPhoneNumber`. With the revolver system, the STOP message might come to any of the user's phone numbers.

Change the user lookup to first check the `PhoneNumber` table, then fall back to `User.telnyxPhoneNumber`:

```js
// First try to find user via PhoneNumber table (revolver system)
let user = null;
const phoneNumberRecord = await prisma.phoneNumber.findFirst({
  where: { phoneNumber: normalizedTo, enabled: true },
  select: { userId: true }
});

if (phoneNumberRecord) {
  user = { id: phoneNumberRecord.userId };
} else {
  // Fallback: check User.telnyxPhoneNumber (legacy single-number setup)
  user = await prisma.user.findFirst({
    where: { telnyxPhoneNumber: normalizedTo },
    select: { id: true }
  });
}
```

### Step 8: Update Telnyx webhook status handler

In `src/app/api/message/status/route.js`, the webhook handler currently finds the user by `messagingProfileId` on the User model. With the revolver system, different phone numbers might have different messaging profile IDs. Update the user lookup to also check `PhoneNumber.messagingProfileId`:

```js
// First try User.telnyxMessagingProfileId (existing behavior)
let user = await prisma.user.findFirst({
  where: { telnyxMessagingProfileId: messagingProfileId },
  select: { id: true }
});

// If not found, check PhoneNumber table
if (!user) {
  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { messagingProfileId: messagingProfileId },
    select: { userId: true }
  });
  if (phoneNumber) {
    user = { id: phoneNumber.userId };
  }
}
```

### Step 9: API routes for phone number CRUD

Create a new API route file at `src/app/api/user/phone-numbers/route.js`:

**GET** — List all phone numbers for the authenticated user:
```js
const phoneNumbers = await prisma.phoneNumber.findMany({
  where: { userId },
  select: {
    id: true,
    phoneNumber: true,
    friendlyName: true,
    type: true,
    messagingProfileId: true,
    enabled: true,
    acceptingNewLeads: true,
    rateLimit: true,
    currentMonthMessages: true,
    _count: { select: { contacts: true } },
    createdAt: true,
  },
  orderBy: { createdAt: 'asc' }
});
```

**POST** — Add a new phone number:
- Validate E.164 format (must match `/^\+1\d{10}$/`)
- Check for duplicate `(userId, phoneNumber)` combination
- Create the record with defaults: `enabled: true`, `acceptingNewLeads: true`, `rateLimit: 1200`
- Accept optional fields: `friendlyName`, `type`, `messagingProfileId`

**PUT** — Update a phone number:
- Accept `id` in the request body
- Updatable fields: `friendlyName`, `enabled`, `acceptingNewLeads`, `rateLimit`, `messagingProfileId`
- Validate that the phone number belongs to the authenticated user
- When `enabled` is set to `false`, also set `acceptingNewLeads` to `false` (a disabled number shouldn't accept new leads)

**DELETE** — Remove a phone number:
- Accept `id` in the request body
- Before deleting, set `assignedPhoneNumberId = null` on all contacts assigned to this number:
  ```js
  await prisma.contact.updateMany({
    where: { assignedPhoneNumberId: id, userId },
    data: { assignedPhoneNumberId: null }
  });
  ```
- Then delete the PhoneNumber record

### Step 10: Settings UI — Phone Number Management

In `src/app/hermes/settings/page.js`, add a new section for managing phone numbers. This should be placed AFTER the existing Telnyx settings section (the single API key / phone / profile section should remain as-is for backward compatibility — it's the "global" Telnyx API key).

The new section should be a card (using the existing `settingsCard` CSS class pattern from `page.module.css`) titled **"Phone Numbers (Revolver)"** with:

1. **A table/list showing all phone numbers** with columns:
   - Phone Number (E.164 format, displayed formatted as (XXX) XXX-XXXX)
   - Friendly Name (editable inline or via modal)
   - Type (toll_free, local, short_code — displayed as badge)
   - Messaging Profile ID (shown truncated, editable)
   - Assigned Contacts (count from `_count.contacts`)
   - Rate Limit (MPM, editable)
   - Status: "Enabled" / "Disabled" toggle switch
   - **Accepting New Leads**: separate toggle switch (this is the KEY FEATURE the user requested — ability to disable a number from receiving new opt-ins while still sending from it)
   - Actions: Edit and Delete buttons

2. **An "Add Phone Number" button** that opens an inline form or modal with:
   - Phone number input (required, validates E.164)
   - Friendly name input (optional)
   - Type dropdown (toll_free selected by default)
   - Messaging Profile ID input (optional — uses the global one from User settings if blank)

3. **Visual indicators**:
   - Numbers that are `enabled: false` should be visually dimmed/grayed out
   - Numbers with `acceptingNewLeads: false` should show an orange "Not accepting leads" badge
   - Show total assigned contacts next to each number
   - Show a summary row at the bottom: "X numbers active, Y accepting leads, Z total contacts assigned"

**Styling**: Follow the existing patterns in `page.module.css`. Use the existing CSS custom properties: `--bg-secondary`, `--bg-tertiary`, `--accent-orange`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-color`. Use the `settingsCard`, `cardHeader`, `saveButton`, `dangerButton` class patterns. Add new CSS classes for the phone number table, toggle switches, and status badges.

**State management**: Use React `useState` hooks. Fetch phone numbers from `GET /api/user/phone-numbers` on mount (add it to the existing `Promise.all` that fetches settings data). Optimistically update the UI on toggle changes, reverting on API error.

**Toggle behavior**: When the user disables a phone number (sets `enabled: false`), automatically set `acceptingNewLeads: false` as well (both in the UI and the API call). When re-enabling, `acceptingNewLeads` should remain `false` until the user explicitly turns it on.

### Step 11: Migration script for existing contacts

Create a new API route or server action `migrateContactsToRevolver(userId)` that:
1. Gets all PhoneNumber records for the user where `acceptingNewLeads: true`
2. Gets all contacts where `assignedPhoneNumberId IS NULL`
3. Distributes them evenly across available numbers using round-robin
4. Uses `prisma.$transaction` with batched `updateMany` calls

This should be callable from the settings UI with a "Migrate Existing Contacts" button that appears when there are unassigned contacts.

---

## IMPORTANT IMPLEMENTATION NOTES

1. **Do NOT remove or modify the existing `sendMessage()` in `src/lib/telnyx.js`**. It's still used by the workflow executor's `sendMessage()` wrapper, single-message test sends, and other non-bulk paths. The new `sendMessageBulkOptimized()` is exclusively for the `executeDedicatedSend()` bulk path.

2. **The existing `telnyxConfig` object** (returned by `getTelnyxConfig()`) uses the User's `telnyxApiKey` to create the Telnyx client. For the revolver system, ALL phone numbers share the same API key (one Telnyx account, multiple numbers). The `from` number and `messagingProfileId` vary per PhoneNumber record, but the `client` stays the same.

3. **Backward compatibility**: If a user has no PhoneNumber records (hasn't set up the revolver system), everything should work exactly as before. Contacts without `assignedPhoneNumberId` use the legacy `User.telnyxPhoneNumber`. The settings page should still show and work with the old single-number Telnyx settings.

4. **The `@paralleldrive/cuid2` package** may need to be installed: `npm install @paralleldrive/cuid2`. If you prefer, you can use `crypto.randomUUID()` instead for generating message IDs, but the IDs must be strings (the Message model uses `String @id @default(cuid())`).

5. **Don't forget to export `normalizePhoneForTelnyx`** from `src/lib/telnyx.js` — it's currently a module-level function that's not exported, but the restructured `executeDedicatedSend()` needs it.

6. **The `executeManualFire()` function** in `src/lib/actions/campaigns.js` also sends messages but through the workflow executor path. For now, leave its send loop as-is (it calls `executeWorkflow()` per contact). The throughput optimization for workflow-based sends can come later. Focus on `executeDedicatedSend()` first since that's the high-volume path.

7. **Test the migration** by running `npx prisma migrate dev --name add-phone-number-revolver` and verifying the schema changes are clean. If there are existing contacts, the new `assignedPhoneNumberId` column will be `null` for all of them, which is expected.
