'use server'

import prisma from '@/lib/prisma'

const PAGE_SIZE = 1000 // Process 1000 contacts at a time

/**
 * Get contacts for a campaign with pagination
 * @param {number} campaignId - Campaign ID
 * @param {number} page - Page number (0-indexed)
 * @param {number} pageSize - Number of contacts per page
 * @returns {Promise<{contacts: Array, hasMore: boolean, total: number}>}
 */
export async function getCampaignContactsPaginated(campaignId, page = 0, pageSize = PAGE_SIZE) {
  const userId = await getUserId()
  
  // Ensure campaignId is an integer
  const campaignIdInt = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId
  
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignIdInt, userId },
    include: {
      targets: {
        include: {
          tag: true
        }
      }
    }
  })

  if (!campaign) throw new Error('Campaign not found')

  // Build where conditions
  const whereConditions = {
    userId,
    subscribed: true,
  }

  // If any target is ALL_SUBSCRIBED, get all subscribed contacts
  if (campaign.targets.some(target => target.targetType === 'ALL_SUBSCRIBED')) {
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: whereConditions,
        skip: page * pageSize,
        take: pageSize,
        orderBy: { id: 'asc' } // Consistent ordering for pagination
      }),
      prisma.contact.count({ where: whereConditions })
    ])
    
    return {
      contacts,
      hasMore: (page + 1) * pageSize < total,
      total
    }
  }

  // Get contacts with matching tags or sources
  const tagIds = campaign.targets
    .filter(target => target.targetType === 'TAG')
    .map(target => target.tagId)
  
  const sourceValues = campaign.targets
    .filter(target => target.targetType === 'SOURCE')
    .map(target => target.sourceValue)
    .filter(Boolean)

  // Build OR conditions for tags and sources
  if (tagIds.length > 0 || sourceValues.length > 0) {
    const orConditions = []
    
    if (tagIds.length > 0) {
      orConditions.push({
        tags: {
          some: {
            id: { in: tagIds }
          }
        }
      })
    }
    
    if (sourceValues.length > 0) {
      orConditions.push({
        source: { in: sourceValues }
      })
    }
    
    if (orConditions.length > 0) {
      whereConditions.OR = orConditions
    }
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where: whereConditions,
      skip: page * pageSize,
      take: pageSize,
      orderBy: { id: 'asc' }
    }),
    prisma.contact.count({ where: whereConditions })
  ])

  return {
    contacts,
    hasMore: (page + 1) * pageSize < total,
    total
  }
}

/**
 * Get contacts for manual fire with pagination
 * @param {Object} params - Selection parameters
 * @param {number} page - Page number (0-indexed)
 * @param {number} pageSize - Number of contacts per page
 * @returns {Promise<{contacts: Array, hasMore: boolean, total: number}>}
 */
export async function getContactsForManualFirePaginated(
  { selectedTags = [], selectedSources = [], targetAllSubscribed = false },
  page = 0,
  pageSize = PAGE_SIZE
) {
  const userId = await getUserId()
  
  const whereConditions = {
    userId,
    subscribed: true,
  }

  if (targetAllSubscribed) {
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: whereConditions,
        skip: page * pageSize,
        take: pageSize,
        orderBy: { id: 'asc' }
      }),
      prisma.contact.count({ where: whereConditions })
    ])
    
    return { contacts, hasMore: (page + 1) * pageSize < total, total }
  }

  // Build OR conditions for tags and sources
  if (selectedTags.length > 0 || selectedSources.length > 0) {
    const orConditions = []
    
    if (selectedTags.length > 0) {
      const tagNames = selectedTags.map(tag => typeof tag === 'string' ? tag : tag.name).filter(Boolean)
      const tags = await prisma.tag.findMany({
        where: { userId, name: { in: tagNames } },
        select: { id: true }
      })
      const tagIds = tags.map(t => t.id)
      
      if (tagIds.length > 0) {
        orConditions.push({
          tags: {
            some: { id: { in: tagIds } }
          }
        })
      }
    }
    
    if (selectedSources.length > 0) {
      orConditions.push({
        source: { in: selectedSources }
      })
    }
    
    if (orConditions.length > 0) {
      whereConditions.OR = orConditions
    }
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where: whereConditions,
      skip: page * pageSize,
      take: pageSize,
      orderBy: { id: 'asc' }
    }),
    prisma.contact.count({ where: whereConditions })
  ])

  return {
    contacts,
    hasMore: (page + 1) * pageSize < total,
    total
  }
}

async function getUserId() {
  const { auth } = await import('@/lib/auth')
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

