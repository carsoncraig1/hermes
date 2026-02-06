'use server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { serverLog } from '@/lib/serverLogger'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

// Helper function to extract shortlink IDs from message text
// Looks for {{SHORTLINK:ID}} markers or txt.cx/shortlink-ID format
function extractShortlinkIds(message) {
  if (!message) return []
  const ids = []
  
  // Pattern 1: {{SHORTLINK:123}} marker format
  const markerRegex = /\{\{SHORTLINK:(\d+)\}\}/g
  let match
  while ((match = markerRegex.exec(message)) !== null) {
    ids.push(parseInt(match[1], 10))
  }
  
  // Pattern 2: txt.cx/shortlink-123 format (legacy support)
  const urlRegex = /https:\/\/txt\.cx\/shortlink-(\d+)/g
  while ((match = urlRegex.exec(message)) !== null) {
    ids.push(parseInt(match[1], 10))
  }
  
  return [...new Set(ids)] // Remove duplicates
}

// Helper function to associate shortlinks with a campaign
async function associateShortlinksWithCampaign(campaignId, message, userId, tx) {
  const shortlinkIds = extractShortlinkIds(message)
  if (shortlinkIds.length === 0) return

  // Find all shortlinks by ID for this user
  const shortlinks = await tx.shortlink.findMany({
    where: {
      userId,
      id: { in: shortlinkIds }
    }
  })

  // Associate them with the campaign
  if (shortlinks.length > 0) {
    await tx.shortlink.updateMany({
      where: {
        id: { in: shortlinks.map(s => s.id) }
      },
      data: {
        campaignId: campaignId
      }
    })
  }
}

export async function createCampaign({ name, message, targetAllSubscribed, selectedTags, selectedSources, workflow }) {
  try {
    const userId = await getUserId()
    
    // If workflow is provided, create workflow-based campaign
    if (workflow) {
      return await prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
          data: {
            userId,
            name,
            workflow: workflow,
            enabled: true,
          },
          include: {
            shortlinks: true
          }
        })
        
        // Extract shortlinks from all action nodes in the workflow
        let allMessages = ''
        if (workflow?.nodes) {
          workflow.nodes.forEach(node => {
            if (node.type === 'action' && node.data?.message) {
              allMessages += ' ' + node.data.message
            }
          })
        }
        
        // Associate shortlinks with campaign
        await associateShortlinksWithCampaign(campaign.id, allMessages, userId, tx)
        
        // Return campaign with shortlinks
        return await tx.campaign.findUnique({
          where: { id: campaign.id },
          include: {
            shortlinks: true
          }
        })
      })
    }
    
    // Legacy campaign creation (for backward compatibility)
    return await prisma.$transaction(async (tx) => {
      // Create the campaign
      const campaign = await tx.campaign.create({
        data: {
          userId,
          name,
          message,
        },
        include: {
          targets: {
            include: {
              tag: true
            }
          },
          shortlinks: true
        }
      })

      // Create campaign targets
      if (targetAllSubscribed) {
        // Create single "ALL_SUBSCRIBED" target
        await tx.campaignTarget.create({
          data: {
            campaignId: campaign.id,
            targetType: 'ALL_SUBSCRIBED'
          }
        })
      } else {
        // Create targets for tags
        if (selectedTags && selectedTags.length > 0) {
          await tx.campaignTarget.createMany({
            data: selectedTags.map(tagId => ({
              campaignId: campaign.id,
              targetType: 'TAG',
              tagId
            }))
          })
        }
        // Create targets for sources
        if (selectedSources && selectedSources.length > 0) {
          await tx.campaignTarget.createMany({
            data: selectedSources.map(sourceValue => ({
              campaignId: campaign.id,
              targetType: 'SOURCE',
              sourceValue
            }))
          })
        }
      }

      // Associate shortlinks with campaign
      await associateShortlinksWithCampaign(campaign.id, message, userId, tx)

      // Fetch the campaign again with all relations
      return await tx.campaign.findUnique({
        where: { id: campaign.id },
        include: {
          targets: {
            include: {
              tag: true
            }
          },
          shortlinks: true
        }
      })
    })
  } catch (error) {
    console.error('Error creating campaign:', error)
    throw error
  }
}

// Function to get all contacts for a campaign
export async function getCampaignContacts(campaignId) {
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

  // If any target is ALL_SUBSCRIBED, get all subscribed contacts for this user
  if (campaign.targets.some(target => target.targetType === 'ALL_SUBSCRIBED')) {
    return await prisma.contact.findMany({
      where: {
        userId,
        subscribed: true
      }
    })
  }

  // Get contacts with matching tags or sources
  const tagIds = campaign.targets
    .filter(target => target.targetType === 'TAG')
    .map(target => target.tagId)
  
  const sourceValues = campaign.targets
    .filter(target => target.targetType === 'SOURCE')
    .map(target => target.sourceValue)
    .filter(Boolean)

  const whereConditions = {
    userId,
    subscribed: true,
  }

  // Build OR conditions for tags and sources
  if (tagIds.length > 0 || sourceValues.length > 0) {
    const orConditions = []
    
    if (tagIds.length > 0) {
      orConditions.push({
        tags: {
          some: {
            id: {
              in: tagIds
            }
          }
        }
      })
    }
    
    if (sourceValues.length > 0) {
      orConditions.push({
        source: {
          in: sourceValues
        }
      })
    }
    
    whereConditions.OR = orConditions
  }

  return await prisma.contact.findMany({
    where: whereConditions
  })
}

// Get contacts by tags and/or sources for manual fire
export async function getContactsForManualFire({ selectedTags = [], selectedSources = [], targetAllSubscribed = false }) {
  try {
    const userId = await getUserId()
    
    if (targetAllSubscribed) {
      return await prisma.contact.findMany({
        where: {
          userId,
          subscribed: true
        }
      })
    }
    
    const whereConditions = {
      userId,
      subscribed: true,
    }
    
    // Build OR conditions for tags and sources
    if (selectedTags.length > 0 || selectedSources.length > 0) {
      const orConditions = []
      
      if (selectedTags.length > 0) {
        // Get tag IDs from tag names (handle both string names and objects with name property)
        const tagNames = selectedTags.map(tag => typeof tag === 'string' ? tag : tag.name).filter(Boolean)
        const tags = await prisma.tag.findMany({
          where: {
            userId,
            name: { in: tagNames }
          },
          select: { id: true }
        })
        const tagIds = tags.map(t => t.id)
        
        if (tagIds.length > 0) {
          orConditions.push({
            tags: {
              some: {
                id: {
                  in: tagIds
                }
              }
            }
          })
        }
      }
      
      if (selectedSources.length > 0) {
        orConditions.push({
          source: {
            in: selectedSources
          }
        })
      }
      
      if (orConditions.length > 0) {
        whereConditions.OR = orConditions
      }
    }
    
    return await prisma.contact.findMany({
      where: whereConditions
    })
  } catch (error) {
    console.error('Error fetching contacts for manual fire:', error)
    throw error
  }
}

// Execute manual fire workflow (with job queue, pagination, retry, and batched stats)
export async function executeManualFire(campaignId, { selectedTags = [], selectedSources = [], targetAllSubscribed = false }) {
  const { createSendJob, updateSendJobProgress, completeSendJob, failSendJob } = await import('@/lib/sendJob')
  const { checkRateLimit } = await import('@/lib/actions/messages')
  const { incrementRateLimitCache } = await import('@/lib/rateLimitCache')
  const { retryWithBackoff, isRetryableError } = await import('@/lib/retry')
  const { getContactsForManualFirePaginated } = await import('@/lib/contactPagination')
  const { executeWorkflow } = await import('@/lib/workflow/executor')
  
  let jobId = null
  const campaignIdInt = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId
  
  // Track sent contact IDs to prevent duplicates within this execution
  const sentContactIds = new Set()
  
  try {
    const userId = await getUserId()
    
    // Verify ownership and get campaign
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignIdInt, userId },
      select: { id: true, name: true, workflow: true }
    })
    
    if (!campaign) throw new Error('Campaign not found')
    if (!campaign.workflow) throw new Error('Campaign is not a workflow campaign')
    
    const triggerNode = campaign.workflow.nodes?.find(node => node.type === 'trigger')
    if (!triggerNode) {
      throw new Error('Campaign workflow does not have a trigger node')
    }
    // Allow manually firing any workflow campaign, not just manual fire ones
    
    // Get total contact count (first page to get total)
    const firstPage = await getContactsForManualFirePaginated(
      { selectedTags, selectedSources, targetAllSubscribed },
      0,
      1
    )
    
    if (firstPage.total === 0) {
      throw new Error('No contacts found matching the selected criteria')
    }
    
    // Calculate batches - optimize for rate limit (1200/min = 20/sec)
    const BATCH_SIZE = 20 // Match rate limit: 20 messages/second
    const totalBatches = Math.ceil(firstPage.total / BATCH_SIZE)
    
    // Create job for tracking - startImmediately=true prevents cron from picking it up
    const job = await createSendJob({
      userId,
      campaignId: campaignIdInt,
      jobType: 'manual_fire',
      totalContacts: firstPage.total,
      totalBatches,
      metadata: { selectedTags, selectedSources, targetAllSubscribed },
      startImmediately: true // Start with 'processing' status to prevent race conditions
    })
    jobId = job.id
    
    await serverLog(
      `Manual fire started: "${campaign.name}" to ${firstPage.total} contacts (Job: ${jobId})`,
      'info',
      { campaignId: campaignIdInt, campaignName: campaign.name, contactsCount: firstPage.total, jobId },
      userId
    ).catch(() => {})
    
    let successCount = 0
    let failCount = 0
    let processedContacts = 0
    let currentBatch = 0
    
    // Process contacts in pages
    let page = 0
    let hasMore = true
    
    while (hasMore) {
      let { contacts, hasMore: more } = await getContactsForManualFirePaginated(
        { selectedTags, selectedSources, targetAllSubscribed },
        page,
        1000 // Load 1000 contacts per page
      )
      
      hasMore = more
      
      // Filter valid contacts AND deduplicate (skip contacts already sent in this execution)
      let validContacts = contacts.filter(c => {
        if (!c.phone || !c.subscribed) return false
        if (sentContactIds.has(c.id)) {
          console.log(`Skipping duplicate contact ${c.id} (${c.phone}) - already processed in this job`)
          return false
        }
        return true
      })
      
      // Process in batches
      for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
        let batch = validContacts.slice(i, i + BATCH_SIZE)
        currentBatch++
        
        // Mark contacts as processed BEFORE execution to prevent race conditions
        batch.forEach(contact => sentContactIds.add(contact.id))
        
        // Check rate limit
        const rateLimit = await checkRateLimit(userId, 1200, 30000, true)
        if (!rateLimit.allowed) {
          const waitTime = rateLimit.retryAfter || 1000
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
        
        // Execute batch with retry
        const batchStartTime = Date.now()
        let results = await Promise.allSettled(
          batch.map(contact =>
            retryWithBackoff(
              () => executeWorkflow(campaign.workflow, contact, userId, campaignIdInt),
              {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: isRetryableError
              }
            )
              .then(() => {
                incrementRateLimitCache(userId).catch(() => {})
                return { success: true, contact }
              })
              .catch(error => {
                console.error(`Error executing workflow for contact ${contact.phone}:`, error)
                return { success: false, contact, error }
              })
          )
        )
        
        // Count results
        results.forEach(result => {
          processedContacts++
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++
          } else {
            failCount++
          }
        })
        
        // Update job progress (async, don't wait)
        updateSendJobProgress(jobId, {
          processedContacts,
          successCount,
          failCount,
          currentBatch
        }).catch(() => {})
        
        // Batch campaign stats update (once per batch instead of per message)
        const batchSuccessCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
        if (batchSuccessCount > 0) {
          prisma.campaign.update({
            where: { id: campaignIdInt },
            data: {
              messagesSent: { increment: batchSuccessCount },
              lastMessageSent: new Date()
            }
          }).catch(() => {}) // Don't block on DB update
        }
        
        // Explicit memory cleanup after batch processing
        batch = null
        results = null
        
        // Dynamic delay: ensure we don't exceed 20 messages/second
        // If batch took less than 1 second, wait the remainder
        const batchDuration = Date.now() - batchStartTime
        const minBatchTime = 1000 // 1 second for 20 messages = 20/sec
        if (batchDuration < minBatchTime && (i + BATCH_SIZE < validContacts.length || hasMore)) {
          await new Promise(resolve => setTimeout(resolve, minBatchTime - batchDuration))
        }
      }
      
      // Clear page data from memory after processing all batches
      contacts = null
      validContacts = null
      
      page++
    }
    
    await completeSendJob(jobId, {
      processedContacts,
      successCount: processedContacts - failCount,
      failCount
    })
    
    await serverLog(
      `Manual fire completed: "${campaign.name}" - ${processedContacts - failCount} executed, ${failCount} failed`,
      failCount === 0 ? 'info' : 'warn',
      { campaignId: campaignIdInt, campaignName: campaign.name, totalContacts: firstPage.total, successCount: processedContacts - failCount, failCount, jobId },
      userId
    ).catch(() => {})
    
    return {
      success: true,
      totalContacts: firstPage.total,
      successCount: processedContacts - failCount,
      failCount,
      jobId
    }
  } catch (error) {
    console.error('Error executing manual fire:', error)
    
    if (jobId) {
      await failSendJob(jobId, error.message).catch(() => {})
    }
    
    throw error
  }
}

export async function getCampaigns() {
  try {
    const userId = await getUserId()
    
    // OPTIMIZED: Fetch campaigns without ALL messages - use _count and separate aggregate queries
    const [campaigns, messageStatsByCampaign, costByCampaign] = await Promise.all([
      // Get campaigns with targets and shortlinks (no messages)
      prisma.campaign.findMany({
        where: { userId },
        include: {
          targets: {
            include: {
              tag: true
            }
          },
          shortlinks: true,
          _count: {
            select: { messages: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      
      // Get message counts by campaign and status
      prisma.message.groupBy({
        by: ['campaignId', 'status'],
        where: {
          userId,
          campaignId: { not: null }
        },
        _count: true
      }),
      
      // Get cost by campaign (delivered only)
      prisma.message.groupBy({
        by: ['campaignId'],
        where: {
          userId,
          campaignId: { not: null },
          status: 'delivered'
        },
        _sum: { costAmount: true }
      })
    ]);
    
    // Build lookup maps for O(1) access
    const statsMap = new Map();
    messageStatsByCampaign.forEach(stat => {
      if (!stat.campaignId) return;
      if (!statsMap.has(stat.campaignId)) {
        statsMap.set(stat.campaignId, { total: 0, delivered: 0, failed: 0, sent: 0, queued: 0 });
      }
      const entry = statsMap.get(stat.campaignId);
      entry.total += stat._count;
      if (stat.status === 'delivered') entry.delivered = stat._count;
      else if (stat.status === 'sending_failed' || stat.status === 'delivery_failed') {
        entry.failed += stat._count;
      }
      else if (stat.status === 'sent') entry.sent = stat._count;
      else if (stat.status === 'queued' || stat.status === 'sending') {
        entry.queued += stat._count;
      }
    });
    
    const costMap = new Map();
    costByCampaign.forEach(stat => {
      if (stat.campaignId) {
        costMap.set(stat.campaignId, stat._sum?.costAmount ? parseFloat(stat._sum.costAmount.toString()) : 0);
      }
    });
    
    // Calculate delivery stats for each campaign using pre-computed maps
    return campaigns.map(campaign => {
      const stats = statsMap.get(campaign.id) || { total: 0, delivered: 0, failed: 0, sent: 0, queued: 0 };
      const totalCost = costMap.get(campaign.id) || 0;
      
      // Convert Decimal to number to avoid client component warnings
      const totalRevenue = campaign.totalRevenue ? parseFloat(campaign.totalRevenue.toString()) : 0;
      
      return {
        id: campaign.id,
        userId: campaign.userId,
        name: campaign.name,
        message: campaign.message,
        workflow: campaign.workflow,
        enabled: campaign.enabled,
        messagesSent: campaign.messagesSent,
        totalRevenue: totalRevenue,
        lastMessageSent: campaign.lastMessageSent,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        targets: campaign.targets,
        shortlinks: campaign.shortlinks,
        messages: [], // No longer fetching all messages - use deliveryStats instead
        deliveryStats: {
          total: stats.total,
          delivered: stats.delivered,
          failed: stats.failed,
          sent: stats.sent,
          queued: stats.queued,
          deliveryRate: stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0,
          totalCost: parseFloat(totalCost.toFixed(4))
        }
      }
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    throw new Error('Failed to fetch campaigns')
  }
}

export async function deleteCampaign(id) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Campaign not found')
    }
    
    await prisma.campaign.delete({
      where: { id }
    })
    return true
  } catch (error) {
    console.error('Error deleting campaign:', error)
    throw new Error('Failed to delete campaign')
  }
}

export async function updateCampaign({ id, name, message, targetAllSubscribed, selectedTags, selectedSources }) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Campaign not found')
    }
    
    return await prisma.$transaction(async (tx) => {
      // Update the campaign
      const campaign = await tx.campaign.update({
        where: { id },
        data: {
          name,
          message,
        }
      })

      // Delete existing targets
      await tx.campaignTarget.deleteMany({
        where: { campaignId: id }
      })

      // Create new targets
      if (targetAllSubscribed) {
        await tx.campaignTarget.create({
          data: {
            campaignId: id,
            targetType: 'ALL_SUBSCRIBED'
          }
        })
      } else {
        // Create targets for tags
        if (selectedTags && selectedTags.length > 0) {
          await tx.campaignTarget.createMany({
            data: selectedTags.map(tagId => ({
              campaignId: id,
              targetType: 'TAG',
              tagId
            }))
          })
        }
        // Create targets for sources
        if (selectedSources && selectedSources.length > 0) {
          await tx.campaignTarget.createMany({
            data: selectedSources.map(sourceValue => ({
              campaignId: id,
              targetType: 'SOURCE',
              sourceValue
            }))
          })
        }
      }

      // Disassociate old shortlinks from this campaign
      await tx.shortlink.updateMany({
        where: { campaignId: id },
        data: { campaignId: null }
      })

      // Associate new shortlinks with campaign
      await associateShortlinksWithCampaign(id, message, userId, tx)

      // Return updated campaign with relations
      const updatedCampaign = await tx.campaign.findUnique({
        where: { id },
        include: {
          targets: {
            include: {
              tag: true
            }
          },
          shortlinks: true
        }
      })
      
      // Convert Decimal to number - explicitly construct object to avoid Decimal serialization issues
      if (updatedCampaign) {
        const totalRevenue = updatedCampaign.totalRevenue ? parseFloat(updatedCampaign.totalRevenue.toString()) : 0;
        return {
          id: updatedCampaign.id,
          userId: updatedCampaign.userId,
          name: updatedCampaign.name,
          message: updatedCampaign.message,
          workflow: updatedCampaign.workflow,
          enabled: updatedCampaign.enabled,
          messagesSent: updatedCampaign.messagesSent,
          totalRevenue: totalRevenue, // Converted to number
          lastMessageSent: updatedCampaign.lastMessageSent,
          createdAt: updatedCampaign.createdAt,
          updatedAt: updatedCampaign.updatedAt,
          targets: updatedCampaign.targets,
          shortlinks: updatedCampaign.shortlinks
        }
      }
      
      return updatedCampaign
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    throw error
  }
}

export async function updateWorkflowCampaign({ id, name, workflow }) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Campaign not found')
    }
    
    return await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.update({
        where: { id },
        data: {
          name,
          workflow: workflow,
        },
        include: {
          shortlinks: true
        }
      })
      
      // Extract shortlinks from all action nodes in the workflow
      let allMessages = ''
      if (workflow?.nodes) {
        workflow.nodes.forEach(node => {
          if (node.type === 'action' && node.data?.message) {
            allMessages += ' ' + node.data.message
          }
        })
      }
      
      // Disassociate old shortlinks from this campaign
      await tx.shortlink.updateMany({
        where: { campaignId: id },
        data: { campaignId: null }
      })
      
      // Associate new shortlinks with campaign
      await associateShortlinksWithCampaign(id, allMessages, userId, tx)
      
      // Return updated campaign
      const updatedCampaign = await tx.campaign.findUnique({
        where: { id },
        include: {
          shortlinks: true
        }
      })
      
      // Convert Decimal to number - explicitly construct object to avoid Decimal serialization issues
      if (updatedCampaign) {
        const totalRevenue = updatedCampaign.totalRevenue ? parseFloat(updatedCampaign.totalRevenue.toString()) : 0;
        return {
          id: updatedCampaign.id,
          userId: updatedCampaign.userId,
          name: updatedCampaign.name,
          message: updatedCampaign.message,
          workflow: updatedCampaign.workflow,
          enabled: updatedCampaign.enabled,
          messagesSent: updatedCampaign.messagesSent,
          totalRevenue: totalRevenue, // Converted to number
          lastMessageSent: updatedCampaign.lastMessageSent,
          createdAt: updatedCampaign.createdAt,
          updatedAt: updatedCampaign.updatedAt,
          shortlinks: updatedCampaign.shortlinks
        }
      }
      
      return updatedCampaign
    })
  } catch (error) {
    console.error('Error updating workflow campaign:', error)
    throw error
  }
}

// Get all workflow campaigns (for manual fire, show all workflow sequences)
export async function getWorkflowCampaigns() {
  try {
    const userId = await getUserId()
    
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        workflow: { not: null },
        enabled: true
      },
      select: {
        id: true,
        name: true,
        workflow: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Return all workflow campaigns (not just manual fire ones)
    // All workflow sequences can be manually fired
    const workflowCampaigns = campaigns.filter(campaign => {
      if (!campaign.workflow?.nodes) return false
      const triggerNode = campaign.workflow.nodes.find(node => node.type === 'trigger')
      return !!triggerNode // Just need a trigger node, any type
    })
    
    return workflowCampaigns
  } catch (error) {
    console.error('Error fetching workflow campaigns:', error)
    throw error
  }
}

export async function getDedicatedSendCampaigns() {
  try {
    const userId = await getUserId()
    
    // Fetch all campaigns and filter for those without workflow
    // Prisma doesn't handle JSON null checks well in where clauses
    const allCampaigns = await prisma.campaign.findMany({
      where: { 
        userId,
        message: { not: '' } // Must have a message
      },
      include: {
        targets: {
          include: {
            tag: true
          }
        },
        shortlinks: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Filter to only campaigns without workflow (legacy/dedicated send)
    // Convert Decimal to number to avoid client component warnings
    const campaigns = allCampaigns
      .filter(campaign => campaign.workflow === null)
      .map(campaign => {
        const totalRevenue = campaign.totalRevenue ? parseFloat(campaign.totalRevenue.toString()) : 0;
        return {
          id: campaign.id,
          userId: campaign.userId,
          name: campaign.name,
          message: campaign.message,
          workflow: campaign.workflow,
          enabled: campaign.enabled,
          messagesSent: campaign.messagesSent,
          totalRevenue: totalRevenue, // Converted to number
          lastMessageSent: campaign.lastMessageSent,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
          targets: campaign.targets,
          shortlinks: campaign.shortlinks
        };
      })
    
    return campaigns
  } catch (error) {
    console.error('Error fetching dedicated send campaigns:', error)
    throw new Error('Failed to fetch campaigns')
  }
}

// Get contact count for a campaign
export async function getCampaignContactCount(campaignId) {
  try {
    const contacts = await getCampaignContacts(campaignId)
    return contacts.length
  } catch (error) {
    console.error('Error getting campaign contact count:', error)
    throw error
  }
}

// Execute a dedicated send campaign (with batching, job queue, pagination, retry, and batched stats)
// @param {number|string} campaignId - Campaign ID
// @param {Date|string|null} scheduledAt - Optional scheduled execution time (null = execute immediately)
// @param {string|null} existingJobId - Optional existing job ID to use (for scheduled jobs processed by job processor)
export async function executeDedicatedSend(campaignId, scheduledAt = null, existingJobId = null) {
  const { createSendJob, claimAndStartJob, updateSendJobProgress, completeSendJob, failSendJob, getSendJob } = await import('@/lib/sendJob')
  const { checkRateLimit } = await import('@/lib/actions/messages')
  const { incrementRateLimitCache } = await import('@/lib/rateLimitCache')
  const { retryWithBackoff, isRetryableError } = await import('@/lib/retry')
  const { getCampaignContactsPaginated } = await import('@/lib/contactPagination')
  const { sendMessage, getTelnyxConfig } = await import('@/lib/telnyx')
  
  let jobId = existingJobId
  const campaignIdInt = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId
  
  // Track sent contact IDs to prevent duplicates within this execution
  const sentContactIds = new Set()
  
  try {
    const userId = await getUserId()
    
    // Verify ownership and get campaign
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
    if (campaign.workflow) throw new Error('Cannot execute workflow campaigns as dedicated send')
    if (!campaign.message) throw new Error('Campaign has no message')
    
    // Get total contact count
    const firstPage = await getCampaignContactsPaginated(campaignIdInt, 0, 1)
    if (firstPage.total === 0) {
      throw new Error('No contacts found for this campaign')
    }
    
    // Calculate batches - optimize for rate limit (1200/min = 20/sec)
    const BATCH_SIZE = 20 // Match rate limit: 20 messages/second
    const totalBatches = Math.ceil(firstPage.total / BATCH_SIZE)
    
    // If using existing job (scheduled job picked up by cron processor)
    if (jobId) {
      const existingJob = await getSendJob(jobId)
      if (!existingJob) throw new Error('Job not found')
      if (existingJob.campaignId !== campaignIdInt) throw new Error('Job campaign ID mismatch')
      
      // ATOMIC: Try to claim the job - prevents race condition with concurrent processors
      const claimed = await claimAndStartJob(jobId)
      if (!claimed) {
        // Job was already claimed by another process - this is expected, not an error
        console.log(`Job ${jobId} already claimed by another process, skipping`)
        return {
          success: true,
          skipped: true,
          reason: 'Job already being processed by another worker',
          jobId
        }
      }
      
      await serverLog(
        `Scheduled dedicated send started: "${campaign.name}" to ${firstPage.total} contacts (Job: ${jobId})`,
        'info',
        { campaignId: campaignIdInt, campaignName: campaign.name, contactsCount: firstPage.total, jobId },
        userId
      ).catch(() => {})
    } else {
      // Parse scheduledAt if provided
      const scheduledDate = scheduledAt ? new Date(scheduledAt) : null
      
      // Validate scheduledAt is in the future if provided
      if (scheduledDate && scheduledDate <= new Date()) {
        throw new Error('Scheduled time must be in the future')
      }
      
      // Create new job
      // For immediate jobs (no scheduledAt), create with startImmediately=true
      // This creates the job with status='processing' so cron can never pick it up
      const job = await createSendJob({
        userId,
        campaignId: campaignIdInt,
        jobType: 'dedicated_send',
        totalContacts: firstPage.total,
        totalBatches,
        scheduledAt: scheduledDate,
        startImmediately: !scheduledDate // Start immediately if no scheduled date
      })
      jobId = job.id
      
      if (!scheduledDate) {
        // Job already started (created with processing status)
        await serverLog(
          `Dedicated send started: "${campaign.name}" to ${firstPage.total} contacts (Job: ${jobId})`,
          'info',
          { campaignId: campaignIdInt, campaignName: campaign.name, contactsCount: firstPage.total, jobId },
          userId
        ).catch(() => {})
      } else {
        await serverLog(
          `Dedicated send scheduled: "${campaign.name}" to ${firstPage.total} contacts at ${scheduledDate.toISOString()} (Job: ${jobId})`,
          'info',
          { campaignId: campaignIdInt, campaignName: campaign.name, contactsCount: firstPage.total, jobId, scheduledAt: scheduledDate.toISOString() },
          userId
        ).catch(() => {})
        
        // Return early for scheduled jobs - they'll be processed by the job processor
        return {
          success: true,
          scheduled: true,
          scheduledAt: scheduledDate.toISOString(),
          totalContacts: firstPage.total,
          jobId
        }
      }
    }
    
    // Pre-fetch user settings and Telnyx config ONCE (optimization: avoid per-message DB lookups)
    const [user, telnyxConfig] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { standardOptOutText: true }
      }),
      getTelnyxConfig(userId)
    ])
    
    // Validate Telnyx config before starting
    if (!telnyxConfig.client) {
      throw new Error(telnyxConfig.error || 'Telnyx API key not configured')
    }
    
    let messageText = campaign.message
    if (user?.standardOptOutText) {
      messageText = `${campaign.message}\n\n${user.standardOptOutText}`
    }
    
    let successCount = 0
    let failCount = 0
    let processedContacts = 0
    let currentBatch = 0
    
    // Process contacts in pages
    let page = 0
    let hasMore = true
    
    while (hasMore) {
      let { contacts, hasMore: more } = await getCampaignContactsPaginated(campaignIdInt, page, 1000)
      hasMore = more
      
      // Filter valid contacts AND deduplicate (skip contacts already sent in this execution)
      let validContacts = contacts.filter(c => {
        if (!c.phone || !c.subscribed) return false
        if (sentContactIds.has(c.id)) {
          console.log(`Skipping duplicate contact ${c.id} (${c.phone}) - already sent in this job`)
          return false
        }
        return true
      })
      
      // Process in batches
      for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
        let batch = validContacts.slice(i, i + BATCH_SIZE)
        currentBatch++
        
        // Mark contacts as sent BEFORE sending to prevent race conditions
        batch.forEach(contact => sentContactIds.add(contact.id))
        
        // Check rate limit
        const rateLimit = await checkRateLimit(userId, 1200, 30000, true)
        if (!rateLimit.allowed) {
          const waitTime = rateLimit.retryAfter || 1000
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
        
        // Execute batch with retry
        // OPTIMIZED: Pass pre-fetched telnyxConfig, skip per-message rate limit and subscription checks
        const batchStartTime = Date.now()
        let results = await Promise.allSettled(
          batch.map(contact =>
            retryWithBackoff(
              () => sendMessage({
                to: contact.phone,
                text: messageText,
                userId,
                contactId: contact.id,
                campaignId: campaignIdInt,
                telnyxConfig,           // Pre-fetched config (avoids 2 DB queries per message)
                skipRateLimit: true,     // Already checked at batch level
                skipSubscriptionCheck: true  // Contacts already filtered for subscribed=true
              }),
              {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: isRetryableError
              }
            )
              .then(result => {
                incrementRateLimitCache(userId).catch(() => {})
                return { success: result.success, contact }
              })
              .catch(error => {
                console.error(`Error sending to ${contact.phone}:`, error)
                return { success: false, contact, error }
              })
          )
        )
        
        // Count results
        const batchSuccessCount = results.filter(r => 
          r.status === 'fulfilled' && r.value.success
        ).length
        
        results.forEach(result => {
          processedContacts++
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++
          } else {
            failCount++
          }
        })
        
        // Update job progress (async, don't wait)
        updateSendJobProgress(jobId, {
          processedContacts,
          successCount,
          failCount,
          currentBatch
        }).catch(() => {})
        
        // Batch campaign stats update (async, don't block)
        if (batchSuccessCount > 0) {
          prisma.campaign.update({
            where: { id: campaignIdInt },
            data: {
              messagesSent: { increment: batchSuccessCount },
              lastMessageSent: new Date()
            }
          }).catch(() => {}) // Don't block on DB update
        }
        
        // Explicit memory cleanup after batch processing
        batch = null
        results = null
        
        // Dynamic delay: ensure we don't exceed 20 messages/second
        // If batch took less than 1 second, wait the remainder
        const batchDuration = Date.now() - batchStartTime
        const minBatchTime = 1000 // 1 second for 20 messages = 20/sec
        if (batchDuration < minBatchTime && (i + BATCH_SIZE < validContacts.length || hasMore)) {
          await new Promise(resolve => setTimeout(resolve, minBatchTime - batchDuration))
        }
      }
      
      // Clear page data from memory after processing all batches
      contacts = null
      validContacts = null
      
      page++
    }
    
    await completeSendJob(jobId, {
      processedContacts,
      successCount,
      failCount
    })
    
    await serverLog(
      `Dedicated send completed: "${campaign.name}" - ${successCount} sent, ${failCount} failed`,
      failCount === 0 ? 'info' : 'warn',
      { campaignId: campaignIdInt, campaignName: campaign.name, totalContacts: firstPage.total, successCount, failCount, jobId },
      userId
    ).catch(() => {})
    
    return {
      success: true,
      totalContacts: firstPage.total,
      successCount,
      failCount,
      jobId
    }
  } catch (error) {
    console.error('Error executing dedicated send:', error)
    
    if (jobId) {
      await failSendJob(jobId, error.message).catch(() => {})
    }
    
    throw error
  }
}
