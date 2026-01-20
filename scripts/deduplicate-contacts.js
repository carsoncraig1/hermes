#!/usr/bin/env node

/**
 * Contact Deduplication Script
 * 
 * This script finds and merges duplicate contacts based on normalized phone numbers.
 * Duplicates are identified per-user (same normalized phone + same userId).
 * 
 * Usage:
 *   node scripts/deduplicate-contacts.js --dry-run    # Preview changes without modifying
 *   node scripts/deduplicate-contacts.js              # Actually perform deduplication
 * 
 * What it does:
 *   1. Normalizes all phone numbers to E.164 format (+1XXXXXXXXXX)
 *   2. Groups contacts by (userId, normalizedPhone)
 *   3. For duplicates, keeps the newest contact and merges data from older ones
 *   4. Merges: tags (union), clickids (union), keeps newest non-null values for other fields
 *   5. Deletes the duplicate contacts
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Normalize phone number to E.164 format (+1XXXXXXXXXX for US numbers)
function normalizePhone(phone) {
  if (!phone) return null;
  
  const cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, '');
  
  // Already in E.164 format with +1
  if (cleaned.startsWith('+1') && digits.length === 11) {
    return `+${digits}`;
  }
  
  // Starts with + but not +1 (non-US) - keep as is but normalize
  if (cleaned.startsWith('+')) {
    if (digits.startsWith('1') && digits.length === 11) {
      return `+${digits}`;
    }
    // Non-US number, return normalized
    return `+${digits}`;
  }
  
  // 11 digits starting with 1 (US number without +)
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }
  
  // 10 digits (US number without country code)
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Can't normalize - return original (will be flagged)
  return null;
}

async function findDuplicates() {
  console.log('🔍 Scanning all contacts...\n');
  
  // Process in batches to avoid "too many bind variables" error
  const BATCH_SIZE = 5000;
  let skip = 0;
  let totalContacts = 0;
  
  // Group by userId + normalizedPhone
  const groups = new Map(); // key: `${userId}:${normalizedPhone}` -> array of contacts
  const invalidPhones = [];
  
  // First, get total count
  const totalCount = await prisma.contact.count();
  console.log(`   Total contacts in database: ${totalCount.toLocaleString()}`);
  console.log(`   Processing in batches of ${BATCH_SIZE}...\n`);
  
  while (skip < totalCount) {
    const batch = await prisma.contact.findMany({
      include: {
        tags: true
        // Don't include messages - causes too many bind variables
      },
      orderBy: {
        createdAt: 'desc' // Newest first
      },
      skip,
      take: BATCH_SIZE
    });
    
    if (batch.length === 0) break;
    
    totalContacts += batch.length;
    const progress = Math.round((totalContacts / totalCount) * 100);
    process.stdout.write(`\r   Processing: ${totalContacts.toLocaleString()} / ${totalCount.toLocaleString()} (${progress}%)`);
    
    for (const contact of batch) {
      const normalized = normalizePhone(contact.phone);
      
      if (!normalized) {
        invalidPhones.push({
          id: contact.id,
          phone: contact.phone,
          userId: contact.userId
        });
        continue;
      }
      
      const key = `${contact.userId}:${normalized}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({
        ...contact,
        normalizedPhone: normalized
      });
    }
    
    skip += BATCH_SIZE;
  }
  
  console.log('\n'); // New line after progress
  
  // Find groups with duplicates
  const duplicateGroups = [];
  let totalDuplicates = 0;
  
  for (const [key, contacts] of groups) {
    if (contacts.length > 1) {
      // Sort by createdAt desc (newest first) to ensure we keep the newest
      contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      duplicateGroups.push({
        key,
        normalizedPhone: contacts[0].normalizedPhone,
        userId: contacts[0].userId,
        contacts: contacts
      });
      totalDuplicates += contacts.length - 1; // All except the one we keep
    }
  }
  
  return { duplicateGroups, totalDuplicates, invalidPhones, totalContacts };
}

function mergeContacts(contacts) {
  // Contacts are already sorted by createdAt desc (newest first)
  // Keep the newest one as the primary, merge data from others
  
  const primary = contacts[0];
  const duplicates = contacts.slice(1);
  
  // Collect all tags (union)
  const allTagIds = new Set((primary.tags || []).map(t => t.id));
  for (const dup of duplicates) {
    for (const tag of (dup.tags || [])) {
      allTagIds.add(tag.id);
    }
  }
  
  // Collect all clickids (union)
  const allClickids = new Set(primary.clickid || []);
  for (const dup of duplicates) {
    if (dup.clickid) {
      for (const cid of dup.clickid) {
        allClickids.add(cid);
      }
    }
  }
  
  // For other fields, use primary's value if set, otherwise try duplicates (newest to oldest)
  const mergedData = {
    firstName: primary.firstName,
    lastName: primary.lastName,
    email: primary.email,
    source: primary.source,
    age: primary.age,
    ip: primary.ip,
    useragent: primary.useragent,
    referrer: primary.referrer,
    // Keep subscribed=true if ANY contact is subscribed
    subscribed: contacts.some(c => c.subscribed === true) ? true : primary.subscribed,
    // Keep hasClicked=true if ANY contact has clicked
    hasClicked: contacts.some(c => c.hasClicked === true),
    // Use most recent lastMessageSent if any
    lastMessageSent: contacts
      .map(c => c.lastMessageSent)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null
  };
  
  // Fill in nulls from duplicates
  for (const dup of duplicates) {
    if (!mergedData.firstName && dup.firstName) mergedData.firstName = dup.firstName;
    if (!mergedData.lastName && dup.lastName) mergedData.lastName = dup.lastName;
    if (!mergedData.email && dup.email) mergedData.email = dup.email;
    if (!mergedData.source && dup.source) mergedData.source = dup.source;
    if (!mergedData.age && dup.age) mergedData.age = dup.age;
    if (!mergedData.ip && dup.ip) mergedData.ip = dup.ip;
    if (!mergedData.useragent && dup.useragent) mergedData.useragent = dup.useragent;
    if (!mergedData.referrer && dup.referrer) mergedData.referrer = dup.referrer;
  }
  
  return {
    primaryId: primary.id,
    primaryPhone: primary.phone,
    normalizedPhone: primary.normalizedPhone,
    duplicateIds: duplicates.map(d => d.id),
    duplicatePhones: duplicates.map(d => d.phone),
    mergedData,
    tagIds: Array.from(allTagIds),
    clickids: Array.from(allClickids)
  };
}

async function performDeduplication(duplicateGroups, dryRun) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(dryRun ? '🔍 DRY RUN - No changes will be made' : '🚀 EXECUTING DEDUPLICATION');
  console.log(`${'='.repeat(60)}\n`);
  
  let processed = 0;
  let deleted = 0;
  let errors = 0;
  
  for (const group of duplicateGroups) {
    const merge = mergeContacts(group.contacts);
    
    console.log(`\n📱 ${merge.normalizedPhone} (User: ${group.userId.substring(0, 8)}...)`);
    console.log(`   Keeping:  ID ${merge.primaryId} (phone: "${merge.primaryPhone}")`);
    console.log(`   Deleting: ${merge.duplicateIds.length} duplicate(s)`);
    
    for (let i = 0; i < merge.duplicateIds.length; i++) {
      console.log(`             - ID ${merge.duplicateIds[i]} (phone: "${merge.duplicatePhones[i]}")`);
    }
    
    if (merge.tagIds.length > 0) {
      console.log(`   Merged tags: ${merge.tagIds.length} total`);
    }
    if (merge.clickids.length > 0) {
      console.log(`   Merged clickids: ${merge.clickids.length} total`);
    }
    
    if (!dryRun) {
      try {
        await prisma.$transaction(async (tx) => {
          // Step 1: Reassign messages from duplicates to primary
          await tx.message.updateMany({
            where: {
              contactId: { in: merge.duplicateIds }
            },
            data: {
              contactId: merge.primaryId
            }
          });
          
          // Step 2: Reassign MessageClickCodes from duplicates to primary
          await tx.messageClickCode.updateMany({
            where: {
              contactId: { in: merge.duplicateIds }
            },
            data: {
              contactId: merge.primaryId
            }
          });
          
          // Step 3: Reassign DelayedWorkflowActions from duplicates to primary
          await tx.delayedWorkflowAction.updateMany({
            where: {
              contactId: { in: merge.duplicateIds }
            },
            data: {
              contactId: merge.primaryId
            }
          });
          
          // Step 4: Update primary contact with merged data and normalized phone
          await tx.contact.update({
            where: { id: merge.primaryId },
            data: {
              phone: merge.normalizedPhone, // Normalize the phone!
              firstName: merge.mergedData.firstName,
              lastName: merge.mergedData.lastName,
              email: merge.mergedData.email,
              source: merge.mergedData.source,
              age: merge.mergedData.age,
              ip: merge.mergedData.ip,
              useragent: merge.mergedData.useragent,
              referrer: merge.mergedData.referrer,
              subscribed: merge.mergedData.subscribed,
              hasClicked: merge.mergedData.hasClicked,
              lastMessageSent: merge.mergedData.lastMessageSent,
              clickid: merge.clickids,
              tags: {
                set: merge.tagIds.map(id => ({ id }))
              }
            }
          });
          
          // Step 5: Delete duplicate contacts
          await tx.contact.deleteMany({
            where: {
              id: { in: merge.duplicateIds }
            }
          });
        });
        
        deleted += merge.duplicateIds.length;
        console.log(`   ✅ Merged and deleted ${merge.duplicateIds.length} duplicate(s)`);
      } catch (error) {
        errors++;
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    processed++;
  }
  
  return { processed, deleted, errors };
}

async function normalizeAllPhones(dryRun) {
  // Also normalize phones that aren't duplicates but aren't in E.164 format
  console.log('\n📞 Checking for non-normalized phone numbers...\n');
  
  const BATCH_SIZE = 10000;
  let skip = 0;
  const toNormalize = [];
  
  const totalCount = await prisma.contact.count();
  
  while (skip < totalCount) {
    const contacts = await prisma.contact.findMany({
      select: { id: true, phone: true },
      skip,
      take: BATCH_SIZE
    });
    
    if (contacts.length === 0) break;
    
    for (const contact of contacts) {
      const normalized = normalizePhone(contact.phone);
      if (normalized && normalized !== contact.phone) {
        toNormalize.push({
          id: contact.id,
          oldPhone: contact.phone,
          newPhone: normalized
        });
      }
    }
    
    skip += BATCH_SIZE;
  }
  
  if (toNormalize.length === 0) {
    console.log('   All phone numbers are already normalized! ✅\n');
    return 0;
  }
  
  console.log(`   Found ${toNormalize.length.toLocaleString()} phone numbers to normalize:\n`);
  
  // Show first 20 examples
  const examples = toNormalize.slice(0, 20);
  for (const item of examples) {
    console.log(`   "${item.oldPhone}" → "${item.newPhone}"`);
  }
  if (toNormalize.length > 20) {
    console.log(`   ... and ${(toNormalize.length - 20).toLocaleString()} more`);
  }
  
  if (!dryRun) {
    console.log('\n   Normalizing phone numbers...');
    
    let updated = 0;
    let errors = 0;
    
    // Process in batches of 100 for updates
    for (let i = 0; i < toNormalize.length; i += 100) {
      const batch = toNormalize.slice(i, i + 100);
      
      await Promise.all(batch.map(async (item) => {
        try {
          await prisma.contact.update({
            where: { id: item.id },
            data: { phone: item.newPhone }
          });
          updated++;
        } catch (error) {
          errors++;
          if (errors <= 10) {
            console.log(`   ❌ Error updating ${item.id}: ${error.message}`);
          }
        }
      }));
      
      // Progress update every 1000
      if ((i + 100) % 1000 === 0 || i + 100 >= toNormalize.length) {
        process.stdout.write(`\r   Progress: ${Math.min(i + 100, toNormalize.length).toLocaleString()} / ${toNormalize.length.toLocaleString()}`);
      }
    }
    
    console.log(`\n   ✅ Normalized ${updated.toLocaleString()} phone numbers${errors > 0 ? `, ${errors} errors` : ''}\n`);
    return updated;
  }
  
  return toNormalize.length;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  console.log('\n' + '='.repeat(60));
  console.log('        CONTACT DEDUPLICATION SCRIPT');
  console.log('='.repeat(60));
  console.log(`\nMode: ${dryRun ? '🔍 DRY RUN (preview only)' : '🚀 LIVE (will modify database)'}`);
  console.log('');
  
  if (!dryRun) {
    console.log('⚠️  WARNING: This will permanently modify your database!');
    console.log('   Run with --dry-run first to preview changes.\n');
    
    // Give user 3 seconds to cancel
    console.log('   Starting in 3 seconds... (Ctrl+C to cancel)\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  try {
    // Step 1: Find duplicates
    const { duplicateGroups, totalDuplicates, invalidPhones, totalContacts } = await findDuplicates();
    
    console.log('📊 SUMMARY');
    console.log('─'.repeat(40));
    console.log(`   Total contacts:     ${totalContacts}`);
    console.log(`   Duplicate groups:   ${duplicateGroups.length}`);
    console.log(`   Duplicates to remove: ${totalDuplicates}`);
    console.log(`   Invalid phones:     ${invalidPhones.length}`);
    
    if (invalidPhones.length > 0) {
      console.log('\n⚠️  Contacts with invalid phone numbers (cannot normalize):');
      const examples = invalidPhones.slice(0, 10);
      for (const item of examples) {
        console.log(`   ID ${item.id}: "${item.phone}"`);
      }
      if (invalidPhones.length > 10) {
        console.log(`   ... and ${invalidPhones.length - 10} more`);
      }
    }
    
    // Step 2: Perform deduplication
    if (duplicateGroups.length > 0) {
      const result = await performDeduplication(duplicateGroups, dryRun);
      
      console.log('\n' + '='.repeat(60));
      console.log('📈 DEDUPLICATION RESULTS');
      console.log('─'.repeat(40));
      console.log(`   Groups processed:   ${result.processed}`);
      console.log(`   Duplicates ${dryRun ? 'to delete' : 'deleted'}:  ${dryRun ? totalDuplicates : result.deleted}`);
      console.log(`   Errors:             ${result.errors}`);
    } else {
      console.log('\n✅ No duplicate contacts found!');
    }
    
    // Step 3: Normalize remaining phones
    const normalized = await normalizeAllPhones(dryRun);
    
    console.log('='.repeat(60));
    console.log(dryRun 
      ? '\n✅ Dry run complete. Run without --dry-run to apply changes.\n'
      : '\n✅ Deduplication complete!\n'
    );
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
