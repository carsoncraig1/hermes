'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}

/**
 * Get count of contacts matching filters
 */
export async function getContactsCount(filters = {}) {
  try {
    const userId = await getUserId();
    const where = buildWhereClause(filters, userId);
    
    const count = await prisma.contact.count({ where });
    return count;
  } catch (error) {
    console.error('Error getting contact count:', error);
    throw error;
  }
}

/**
 * Build Prisma where clause from filters
 */
function buildWhereClause(filters, userId) {
  const where = { userId };

  // Apply subscribed filter
  if (filters.subscribed !== undefined) {
    where.subscribed = filters.subscribed === 'true' || filters.subscribed === true;
  }

  // Apply search filter
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    where.OR = [
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { phone: { contains: searchTerm, mode: 'insensitive' } },
      { source: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  // Apply level filters
  applyLevelFilter(where, filters.level1);
  applyLevelFilter(where, filters.level2);
  applyLevelFilter(where, filters.level3);

  return where;
}

/**
 * Apply a level filter to where clause
 */
function applyLevelFilter(where, filter) {
  if (!filter?.field || !filter?.value) return;

  const { field, operator, value, value2 } = filter;

  // Handle tag filters
  if (field === 'tags') {
    const searchValue = value.toLowerCase();

    if (operator === 'doesNotContain') {
      if (!where.NOT) where.NOT = {};
      if (!where.NOT.tags) where.NOT.tags = {};
      where.NOT.tags.some = {
        name: { contains: searchValue, mode: 'insensitive' }
      };
    } else if (operator === 'equals') {
      where.tags = {
        some: {
          name: { equals: searchValue, mode: 'insensitive' }
        }
      };
    } else if (operator === 'contains') {
      where.tags = {
        some: {
          name: { contains: searchValue, mode: 'insensitive' }
        }
      };
    } else if (operator === 'startsWith') {
      where.tags = {
        some: {
          name: { startsWith: searchValue, mode: 'insensitive' }
        }
      };
    } else if (operator === 'endsWith') {
      where.tags = {
        some: {
          name: { endsWith: searchValue, mode: 'insensitive' }
        }
      };
    } else if (operator === 'notEquals') {
      if (!where.NOT) where.NOT = {};
      if (!where.NOT.tags) where.NOT.tags = {};
      where.NOT.tags.some = {
        name: { equals: searchValue, mode: 'insensitive' }
      };
    }
    return;
  }

  // Handle date fields
  if (field === 'createdAt' || field === 'updatedAt' || field === 'lastMessageSent') {
    const filterDate = new Date(value);
    
    if (operator === 'equals') {
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      where[field] = { gte: startOfDay, lte: endOfDay };
    } else if (operator === 'before') {
      // For "before", include null values (never messaged) OR dates before the filter date
      // This is especially important for lastMessageSent to show contacts who haven't been messaged
      if (field === 'lastMessageSent') {
        where.OR = [
          { [field]: null },
          { [field]: { lt: filterDate } }
        ];
      } else {
        where[field] = { lt: filterDate };
      }
    } else if (operator === 'after') {
      // For "after", exclude null values (only show contacts with actual dates)
      where[field] = { 
        not: null,
        gt: filterDate 
      };
    } else if (operator === 'between' && value2) {
      const filterDate2 = new Date(value2);
      where[field] = { gte: filterDate, lte: filterDate2 };
    }
    return;
  }

  // Handle text fields
  const searchValue = value.toLowerCase();
  if (operator === 'equals') {
    where[field] = { equals: searchValue, mode: 'insensitive' };
  } else if (operator === 'contains') {
    where[field] = { contains: searchValue, mode: 'insensitive' };
  } else if (operator === 'startsWith') {
    where[field] = { startsWith: searchValue, mode: 'insensitive' };
  } else if (operator === 'endsWith') {
    where[field] = { endsWith: searchValue, mode: 'insensitive' };
  } else if (operator === 'notEquals') {
    where[field] = { not: { equals: searchValue, mode: 'insensitive' } };
  } else if (operator === 'doesNotContain') {
    where[field] = { not: { contains: searchValue, mode: 'insensitive' } };
  }
}

/**
 * Bulk tag contacts with split configuration
 */
export async function bulkTagContacts({ filters, splits, splitMethod, selectionMethod, preventOverlap, remainingTag, tagOperation }) {
  try {
    const userId = await getUserId();
    const where = buildWhereClause(filters, userId);

    // Get all matching contact IDs
    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true },
      orderBy: selectionMethod === 'sequential' ? { createdAt: 'asc' } : undefined
    });

    const totalContacts = contacts.length;
    if (totalContacts === 0) {
      return { totalTagged: 0, splitsProcessed: 0 };
    }

    // If random, shuffle the array
    let contactIds = contacts.map(c => c.id);
    if (selectionMethod === 'random') {
      // Fisher-Yates shuffle
      for (let i = contactIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [contactIds[i], contactIds[j]] = [contactIds[j], contactIds[i]];
      }
    }

    let taggedContactIds = new Set();
    let totalTagged = 0;
    let splitsProcessed = 0;

    // Process each split
    for (const split of splits) {
      let splitCount;
      if (split.isPercentage) {
        splitCount = Math.floor((totalContacts * split.value) / 100);
      } else {
        splitCount = Math.min(split.value, totalContacts - taggedContactIds.size);
      }

      if (splitCount <= 0) continue;

      // Get contacts for this split
      let splitContactIds;
      if (preventOverlap) {
        // Get contacts that haven't been tagged yet
        splitContactIds = contactIds
          .filter(id => !taggedContactIds.has(id))
          .slice(0, splitCount);
      } else {
        // Allow overlap - just take next N contacts
        splitContactIds = contactIds.slice(0, splitCount);
      }

      if (splitContactIds.length === 0) continue;

      // Upsert the tag
      const tag = await prisma.tag.upsert({
        where: {
          name_userId: {
            name: split.tagName,
            userId
          }
        },
        update: {},
        create: {
          name: split.tagName,
          userId
        }
      });

      // Get existing tags for contacts to determine update strategy
      const contactsWithTags = await prisma.contact.findMany({
        where: { id: { in: splitContactIds } },
        include: { tags: true }
      });

      // Update each contact
      for (const contact of contactsWithTags) {
        const existingTagIds = contact.tags.map(t => t.id);
        let newTagIds;

        if (tagOperation === 'add') {
          // Add tag if not already present
          if (!existingTagIds.includes(tag.id)) {
            newTagIds = [...existingTagIds, tag.id];
          } else {
            newTagIds = existingTagIds;
          }
        } else if (tagOperation === 'remove') {
          // Remove tag if present
          newTagIds = existingTagIds.filter(id => id !== tag.id);
        } else {
          // Replace - set to only this tag
          newTagIds = [tag.id];
        }

        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            tags: {
              set: newTagIds.map(id => ({ id }))
            }
          }
        });
      }

      // Track tagged contacts
      splitContactIds.forEach(id => taggedContactIds.add(id));
      totalTagged += splitContactIds.length;
      splitsProcessed++;
    }

    // Handle remaining contacts
    if (remainingTag && remainingTag.trim()) {
      const remainingContactIds = contactIds.filter(id => !taggedContactIds.has(id));
      
      if (remainingContactIds.length > 0) {
        const tag = await prisma.tag.upsert({
          where: {
            name_userId: {
              name: remainingTag.trim(),
              userId
            }
          },
          update: {},
          create: {
            name: remainingTag.trim(),
            userId
          }
        });

        const contactsWithTags = await prisma.contact.findMany({
          where: { id: { in: remainingContactIds } },
          include: { tags: true }
        });

        for (const contact of contactsWithTags) {
          const existingTagIds = contact.tags.map(t => t.id);
          let newTagIds;

          if (tagOperation === 'add') {
            if (!existingTagIds.includes(tag.id)) {
              newTagIds = [...existingTagIds, tag.id];
            } else {
              newTagIds = existingTagIds;
            }
          } else if (tagOperation === 'remove') {
            newTagIds = existingTagIds.filter(id => id !== tag.id);
          } else {
            newTagIds = [tag.id];
          }

          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              tags: {
                set: newTagIds.map(id => ({ id }))
              }
            }
          });
        }

        totalTagged += remainingContactIds.length;
      }
    }

    return {
      totalTagged,
      splitsProcessed,
      totalContacts
    };
  } catch (error) {
    console.error('Error in bulk tag contacts:', error);
    throw error;
  }
}

