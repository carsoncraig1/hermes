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

export async function getContacts(limit = null) {
  try {
    const userId = await getUserId()
    console.log('Starting getContacts...');
    
    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        tags: true
      },
      ...(limit && { take: limit })
    });
    
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
 * Processes contacts in batches for better performance
 * @param {Array} contactsData - Array of contact data objects
 * @param {number} batchSize - Number of contacts to process per batch (default: 50)
 * @param {Function} onProgress - Optional callback for progress updates (processed, total, errors)
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
export async function addContactsBatch(contactsData, batchSize = 50, onProgress = null) {
  try {
    const userId = await getUserId()
    let successCount = 0
    let failedCount = 0
    const errors = []
    
    // Process in batches
    for (let i = 0; i < contactsData.length; i += batchSize) {
      const batch = contactsData.slice(i, i + batchSize)
      
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
          
          // Process each contact in the batch
          for (const contactData of batch) {
            try {
              // Handle clickid
              let clickidArray = []
              if (contactData.clickid) {
                clickidArray = Array.isArray(contactData.clickid) ? contactData.clickid : [contactData.clickid]
              } else if (contactData.clickId) {
                clickidArray = Array.isArray(contactData.clickId) ? contactData.clickId : [contactData.clickId]
              }
              
              // Get tag connections for this contact
              const tagConnections = (contactData.tags || [])
                .map(tagName => ({ id: tagMap.get(tagName) }))
                .filter(tag => tag.id) // Remove any undefined tags
              
              // Check if contact already exists (phone + userId)
              const existingContact = await tx.contact.findFirst({
                where: {
                  phone: contactData.phone,
                  userId: userId
                }
              })
              
              if (existingContact) {
                // Update existing contact
                await tx.contact.update({
                  where: { id: existingContact.id },
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
                    tags: tagConnections.length > 0 ? {
                      set: tagConnections
                    } : undefined
                  }
                })
              } else {
                // Create new contact
                await tx.contact.create({
                  data: {
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
                    tags: tagConnections.length > 0 ? {
                      connect: tagConnections
                    } : undefined
                  }
                })
              }
              
              successCount++
            } catch (contactError) {
              failedCount++
              const rowIndex = i + batch.indexOf(contactData) + 2 // +2 for header and 0-indexing
              errors.push({
                row: rowIndex,
                contact: contactData,
                error: contactError.message || 'Unknown error'
              })
            }
          }
        })
      } catch (batchError) {
        // If entire batch fails, mark all as failed
        batch.forEach((contactData, idx) => {
          failedCount++
          errors.push({
            row: i + idx + 2,
            contact: contactData,
            error: batchError.message || 'Batch processing error'
          })
        })
      }
      
      // Call progress callback after each batch
      if (onProgress) {
        onProgress(Math.min(i + batchSize, contactsData.length), contactsData.length, errors)
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
      where: { id: data.id, userId }
    })
    if (!existing) {
      throw new Error('Contact not found')
    }
    
    // Handle tags update
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
      tags: {
        set: [], // Clear existing tags
        connect: tagConnections // Connect new tags
      }
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
