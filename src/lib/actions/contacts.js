'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

/**
 * Apply boolean filter to where clause
 */
function applyBooleanFilter(where, filter) {
  if (!filter?.field || !filter?.value) return;
  
  const { field, operator, value } = filter;
  
  // Handle boolean fields
  if (field === 'hasClicked' || field === 'subscribed') {
    // Only apply filter if value is explicitly 'true' or 'false'
    if (value !== 'true' && value !== 'false') {
      return; // Don't apply filter if value is empty or invalid
    }
    
    const filterValue = value === 'true';
    if (operator === 'equals') {
      where[field] = filterValue;
    } else if (operator === 'notEquals') {
      // For boolean fields, "not equals true" means equals false, and vice versa
      where[field] = !filterValue;
    }
  }
}

export async function getContacts(limit = 100, includeTags = false) {
  try {
    const userId = await getUserId()
    console.log('Starting getContacts...');
    
    // Use a reasonable default limit to avoid Prisma bind variable limits
    // When including tags, each contact-tag relationship creates bind variables
    // With many contacts and tags, this can exceed PostgreSQL's 32767 bind variable limit
    const safeLimit = limit || 100;
    
    const queryOptions = {
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      },
      take: safeLimit
    };
    
    // Only include tags if explicitly requested to avoid bind variable issues
    if (includeTags) {
      queryOptions.include = {
        tags: {
          select: {
            id: true,
            name: true
          }
        }
      };
    }
    
    const contacts = await prisma.contact.findMany(queryOptions);
    
    console.log(`Fetched ${contacts.length} contacts`);
    return contacts;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
}

export async function getContactsPaginated(page = 0, pageSize = 20, filters = {}) {
  try {
    const userId = await getUserId()
    
    // Build where clause
    const where = { userId }
    
    // Apply subscribed filter if provided
    if (filters.subscribed !== undefined) {
      where.subscribed = filters.subscribed === 'true' || filters.subscribed === true
    }
    
    // Apply search filter if provided
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { source: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }
    
    // Apply boolean filters server-side (hasClicked, subscribed)
    applyBooleanFilter(where, filters.level1);
    applyBooleanFilter(where, filters.level2);
    applyBooleanFilter(where, filters.level3);
    
    // Apply tag filters server-side
    // Check each level filter for tag filters
    const tagFilters = []
    if (filters.level1?.field === 'tags' && filters.level1?.value) {
      tagFilters.push(filters.level1)
    }
    if (filters.level2?.field === 'tags' && filters.level2?.value) {
      tagFilters.push(filters.level2)
    }
    if (filters.level3?.field === 'tags' && filters.level3?.value) {
      tagFilters.push(filters.level3)
    }
    
    // Apply the first tag filter (most common use case - can enhance later for multiple)
    if (tagFilters.length > 0) {
      const tagFilter = tagFilters[0] // Use first tag filter
      const searchValue = tagFilter.value.toLowerCase()
      const operator = tagFilter.operator || 'contains'
      
      if (operator === 'doesNotContain') {
        // Exclude contacts that have any tag containing the search value
        where.NOT = {
          tags: {
            some: {
              name: { contains: searchValue, mode: 'insensitive' }
            }
          }
        }
      } else if (operator === 'contains') {
        // Include contacts that have at least one tag containing the search value
        where.tags = {
          some: {
            name: { contains: searchValue, mode: 'insensitive' }
          }
        }
      } else if (operator === 'equals') {
        where.tags = {
          some: {
            name: { equals: searchValue, mode: 'insensitive' }
          }
        }
      } else if (operator === 'startsWith') {
        where.tags = {
          some: {
            name: { startsWith: searchValue, mode: 'insensitive' }
          }
        }
      } else if (operator === 'endsWith') {
        where.tags = {
          some: {
            name: { endsWith: searchValue, mode: 'insensitive' }
          }
        }
      } else if (operator === 'notEquals') {
        where.NOT = {
          tags: {
            some: {
              name: { equals: searchValue, mode: 'insensitive' }
            }
          }
        }
      }
    }
    
    // Get total count and contacts
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          tags: true
        },
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.contact.count({ where })
    ])
    
    return {
      contacts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: (page + 1) * pageSize < total
    }
  } catch (error) {
    console.error('Error fetching paginated contacts:', error);
    throw error;
  }
}

export async function addContact(data) {
  try {
    const userId = await getUserId()
    
    // Handle tags - either connect existing ones or create new ones (for this user)
    const tagConnections = await Promise.all(
      (data.tags || []).map(async (tagName) => {
        const tag = await prisma.tag.upsert({
          where: { 
            name_userId: { name: tagName, userId }
          },
          update: {},
          create: { name: tagName, userId }
        });
        return { id: tag.id };
      })
    );

    // Handle clickid - support both array and single value
    let clickidArray = []
    if (data.clickid) {
      clickidArray = Array.isArray(data.clickid) ? data.clickid : [data.clickid]
    } else if (data.clickId) {
      clickidArray = Array.isArray(data.clickId) ? data.clickId : [data.clickId]
    }

    const contact = await prisma.contact.create({
      data: {
        userId,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone,
        clickid: clickidArray,
        source: data.source || null,
        age: data.age || null,
        ip: data.ip || null,
        useragent: data.useragent || null,
        referrer: data.referrer || null,
        subscribed: data.subscribed !== undefined ? data.subscribed : true,
        tags: {
          connect: tagConnections
        }
      },
      include: {
        tags: true
      }
    });
    return contact;
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
}

/**
 * Batch upload contacts from CSV
 * Optimized to use bulk operations for better performance
 * @param {Array} contactsData - Array of contact data objects
 * @param {number} batchSize - Number of contacts to process per batch (default: 1000)
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
export async function addContactsBatch(contactsData, batchSize = 1000) {
  try {
    const userId = await getUserId()
    let successCount = 0
    let failedCount = 0
    const errors = []
    
    // Process in batches
    for (let i = 0; i < contactsData.length; i += batchSize) {
      const batch = contactsData.slice(i, i + batchSize)
      const batchStartIndex = i
      
      // Process batch in transaction
      try {
        await prisma.$transaction(async (tx) => {
          // Collect all unique tag names from this batch
          const allTagNames = new Set()
          batch.forEach(contact => {
            if (contact.tags && Array.isArray(contact.tags)) {
              contact.tags.forEach(tagName => allTagNames.add(tagName))
            }
          })
          
          // Upsert all tags for this batch in one go
          const tagMap = new Map()
          if (allTagNames.size > 0) {
            await Promise.all(
              Array.from(allTagNames).map(async (tagName) => {
                const tag = await tx.tag.upsert({
                  where: { 
                    name_userId: { name: tagName, userId }
                  },
                  update: {},
                  create: { name: tagName, userId }
                })
                tagMap.set(tagName, tag.id)
              })
            )
          }
          
          // Batch check for existing contacts - query all phones at once
          const phones = batch.map(c => c.phone).filter(Boolean)
          const existingContacts = await tx.contact.findMany({
            where: {
              phone: { in: phones },
              userId: userId
            },
            select: { id: true, phone: true }
          })
          
          // Create a map of phone -> contact id for quick lookup
          const existingContactMap = new Map()
          existingContacts.forEach(contact => {
            existingContactMap.set(contact.phone, contact.id)
          })
          
          // Separate new and existing contacts
          const newContacts = []
          const updateContacts = []
          const contactTagMap = new Map() // Map phone number to tag IDs for new contacts
          
          batch.forEach((contactData, batchIdx) => {
            try {
              // Handle clickid
              let clickidArray = []
              if (contactData.clickid) {
                clickidArray = Array.isArray(contactData.clickid) ? contactData.clickid : [contactData.clickid]
              } else if (contactData.clickId) {
                clickidArray = Array.isArray(contactData.clickId) ? contactData.clickId : [contactData.clickId]
              }
              
              // Get tag connections for this contact
              const tagIds = (contactData.tags || [])
                .map(tagName => tagMap.get(tagName))
                .filter(id => id) // Remove any undefined tags
              
              const existingId = existingContactMap.get(contactData.phone)
              
              if (existingId) {
                // Store for batch update
                updateContacts.push({
                  id: existingId,
                  data: {
                    firstName: contactData.firstName || undefined,
                    lastName: contactData.lastName || undefined,
                    email: contactData.email || undefined,
                    source: contactData.source || undefined,
                    age: contactData.age || undefined,
                    ip: contactData.ip || undefined,
                    useragent: contactData.useragent || undefined,
                    referrer: contactData.referrer || undefined,
                    subscribed: contactData.subscribed !== undefined ? contactData.subscribed : undefined,
                    clickid: clickidArray.length > 0 ? clickidArray : [],
                  },
                  tagIds: tagIds
                })
              } else {
                // Store for batch create
                newContacts.push({
                  userId,
                  firstName: contactData.firstName || null,
                  lastName: contactData.lastName || null,
                  email: contactData.email || null,
                  phone: contactData.phone,
                  clickid: clickidArray,
                  source: contactData.source || null,
                  age: contactData.age || null,
                  ip: contactData.ip || null,
                  useragent: contactData.useragent || null,
                  referrer: contactData.referrer || null,
                  subscribed: contactData.subscribed !== undefined ? contactData.subscribed : true,
                })
                // Use phone as key for reliable mapping
                contactTagMap.set(contactData.phone, tagIds)
              }
            } catch (contactError) {
              failedCount++
              const rowIndex = batchStartIndex + batchIdx + 2 // +2 for header and 0-indexing
              errors.push({
                row: rowIndex,
                contact: contactData,
                error: contactError.message || 'Unknown error'
              })
            }
          })
          
          // Bulk create new contacts (createMany doesn't support relations, so we handle tags separately)
          if (newContacts.length > 0) {
            await tx.contact.createMany({
              data: newContacts,
              skipDuplicates: true
            })
            
            // Fetch the newly created contacts to get their IDs for tag connections
            const phonesToFetch = newContacts.map(c => c.phone)
            const createdContacts = await tx.contact.findMany({
              where: {
                phone: { in: phonesToFetch },
                userId: userId
              },
              select: { id: true, phone: true }
            })
            
            // Create phone -> id map for new contacts
            const newContactMap = new Map()
            createdContacts.forEach(contact => {
              newContactMap.set(contact.phone, contact.id)
            })
            
            // Connect tags to new contacts in parallel batches
            const tagConnectionPromises = []
            newContacts.forEach((contact) => {
              const contactId = newContactMap.get(contact.phone)
              const tagIds = contactTagMap.get(contact.phone) || []
              if (contactId && tagIds.length > 0) {
                tagConnectionPromises.push(
                  tx.contact.update({
                    where: { id: contactId },
                    data: {
                      tags: {
                        connect: tagIds.map(tagId => ({ id: tagId }))
                      }
                    }
                  })
                )
              }
            })
            
            // Execute tag connections in parallel (with reasonable concurrency)
            if (tagConnectionPromises.length > 0) {
              // Process in chunks of 100 to avoid overwhelming the database
              const chunkSize = 100
              for (let j = 0; j < tagConnectionPromises.length; j += chunkSize) {
                const chunk = tagConnectionPromises.slice(j, j + chunkSize)
                await Promise.all(chunk)
              }
            }
            
            successCount += createdContacts.length
          }
          
          // Batch update existing contacts
          if (updateContacts.length > 0) {
            // Update contacts in parallel
            await Promise.all(
              updateContacts.map(async ({ id, data, tagIds }) => {
                await tx.contact.update({
                  where: { id },
                  data: {
                    ...data,
                    tags: tagIds.length > 0 ? {
                      set: tagIds.map(tagId => ({ id: tagId }))
                    } : undefined
                  }
                })
              })
            )
            
            successCount += updateContacts.length
          }
        }, {
          timeout: 30000 // 30 second timeout for large batches
        })
      } catch (batchError) {
        // If entire batch fails, mark all as failed
        batch.forEach((contactData, idx) => {
          failedCount++
          errors.push({
            row: batchStartIndex + idx + 2,
            contact: contactData,
            error: batchError.message || 'Batch processing error'
          })
        })
      }
    }
    
    return {
      success: successCount,
      failed: failedCount,
      errors
    }
  } catch (error) {
    console.error('Error in batch contact upload:', error);
    throw error;
  }
}

export async function updateContact(data) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: { id: data.id, userId },
      include: { tags: true }
    })
    if (!existing) {
      throw new Error('Contact not found')
    }
    
    // Handle tags update - support add, remove, or replace operations
    let tagUpdate = undefined;
    if (data.tags !== undefined) {
      const tagOperation = data.tagOperation || 'replace'; // 'add', 'remove', or 'replace'
      
      // Get existing tag IDs
      const existingTagIds = existing.tags.map(tag => tag.id);
      const existingTagNames = existing.tags.map(tag => tag.name);
      
      // Upsert all tags mentioned in the update
      const tagConnections = await Promise.all(
        (data.tags || []).map(async (tagName) => {
          const tag = await prisma.tag.upsert({
            where: { 
              name_userId: { name: tagName, userId }
            },
            update: {},
            create: { name: tagName, userId }
          });
          return { id: tag.id };
        })
      );
      
      const newTagIds = tagConnections.map(tc => tc.id);
      
      if (tagOperation === 'add') {
        // Merge existing tags with new tags (avoid duplicates)
        const allTagIds = [...new Set([...existingTagIds, ...newTagIds])];
        tagUpdate = {
          set: allTagIds.map(id => ({ id }))
        };
      } else if (tagOperation === 'remove') {
        // Remove specified tags from existing tags
        const remainingTagIds = existingTagIds.filter(id => !newTagIds.includes(id));
        tagUpdate = {
          set: remainingTagIds.map(id => ({ id }))
        };
      } else {
        // Default: replace (set to new tags only)
        tagUpdate = {
          set: newTagIds.map(id => ({ id }))
        };
      }
    }

    // Handle clickid - support both array and single value
    let clickidArray = []
    if (data.clickid !== undefined) {
      clickidArray = Array.isArray(data.clickid) ? data.clickid : (data.clickid ? [data.clickid] : [])
    } else if (data.clickId !== undefined) {
      clickidArray = Array.isArray(data.clickId) ? data.clickId : (data.clickId ? [data.clickId] : [])
    }

    // If unsubscribing, set unsubscribe reason to "manual"
    const updateData = {
      firstName: data.firstName !== undefined ? (data.firstName || null) : undefined,
      lastName: data.lastName !== undefined ? (data.lastName || null) : undefined,
      email: data.email !== undefined ? (data.email || null) : undefined,
      phone: data.phone,
      clickid: clickidArray.length > 0 ? clickidArray : undefined,
      source: data.source !== undefined ? (data.source || null) : undefined,
      age: data.age !== undefined ? (data.age || null) : undefined,
      ip: data.ip !== undefined ? (data.ip || null) : undefined,
      useragent: data.useragent !== undefined ? (data.useragent || null) : undefined,
      referrer: data.referrer !== undefined ? (data.referrer || null) : undefined,
      subscribed: data.subscribed,
      ...(tagUpdate && { tags: tagUpdate })
    };

    // If unsubscribing, set unsubscribe reason to "manual"
    if (data.subscribed === false && existing.subscribed === true) {
      updateData.unsubscribeReason = 'manual';
    } else if (data.subscribed === true && existing.subscribed === false) {
      // If resubscribing, clear unsubscribe reason
      updateData.unsubscribeReason = null;
    }

    const contact = await prisma.contact.update({
      where: { id: data.id },
      data: updateData,
      include: {
        tags: true
      }
    });
    return contact;
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
}

export async function deleteContact(id) {
  try {
    const userId = await getUserId()
    
    // Verify ownership before deleting
    const existing = await prisma.contact.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Contact not found')
    }
    
    await prisma.contact.delete({
      where: { id }
    })
    return { success: true }
  } catch (error) {
    console.error('Error deleting contact:', error)
    throw new Error('Failed to delete contact')
  }
}

export async function getSubscribedContactsCount() {
  try {
    const userId = await getUserId()
    
    const count = await prisma.contact.count({
      where: {
        userId,
        subscribed: true
      }
    });
    return count;
  } catch (error) {
    console.error('Error getting subscribed contacts count:', error);
    throw new Error('Failed to get subscribed contacts count');
  }
}
