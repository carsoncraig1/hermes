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

export async function getCampaigns() {
  try {
    const userId = await getUserId()
    
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        targets: {
          include: {
            tag: true
          }
        },
        shortlinks: true,
        messages: {
          select: {
            status: true,
            costAmount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Calculate delivery stats for each campaign
    return campaigns.map(campaign => {
      const messages = campaign.messages || []
      const total = messages.length
      const delivered = messages.filter(m => m.status === 'delivered').length
      const failed = messages.filter(m => 
        m.status === 'sending_failed' || m.status === 'delivery_failed'
      ).length
      const sent = messages.filter(m => m.status === 'sent').length
      const queued = messages.filter(m => m.status === 'queued' || m.status === 'sending').length
      
      const totalCost = messages.reduce((sum, m) => {
        return sum + (m.costAmount ? parseFloat(m.costAmount) : 0)
      }, 0)
      
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
        totalRevenue: totalRevenue, // Converted to number
        lastMessageSent: campaign.lastMessageSent,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        targets: campaign.targets,
        shortlinks: campaign.shortlinks,
        deliveryStats: {
          total,
          delivered,
          failed,
          sent,
          queued,
          deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
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

// Get only dedicated send campaigns (legacy campaigns without workflow)
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

// Execute a dedicated send campaign
export async function executeDedicatedSend(campaignId) {
  try {
    const userId = await getUserId()
    
    // Ensure campaignId is an integer
    const campaignIdInt = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId
    
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
    
    if (!campaign) {
      throw new Error('Campaign not found')
    }
    
    if (campaign.workflow) {
      throw new Error('Cannot execute workflow campaigns as dedicated send')
    }
    
    if (!campaign.message) {
      throw new Error('Campaign has no message')
    }
    
    // Get all contacts for this campaign
    const contacts = await getCampaignContacts(campaignIdInt)
    
    if (contacts.length === 0) {
      throw new Error('No contacts found for this campaign')
    }
    
    // Log dedicated send start
    await serverLog(
      `Dedicated send started: "${campaign.name}" to ${contacts.length} contacts`,
      'info',
      {
        campaignId: campaignIdInt,
        campaignName: campaign.name,
        contactsCount: contacts.length
      },
      userId
    ).catch(err => console.error('Error logging dedicated send start:', err))
    
    // Import sendMessage from telnyx
    const { sendMessage } = await import('@/lib/telnyx')
    
    // Get user's standard opt-out text if set
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { standardOptOutText: true }
    })
    
    // Build the message with opt-out text if available
    let messageText = campaign.message
    if (user?.standardOptOutText) {
      messageText = `${campaign.message}\n\n${user.standardOptOutText}`
    }
    
    // Send messages to all contacts
    let successCount = 0
    let failCount = 0
    
    for (const contact of contacts) {
      if (!contact.phone) {
        failCount++
        continue
      }
      
      try {
        const result = await sendMessage({
          to: contact.phone,
          text: messageText,
          userId: userId, // Pass userId so it uses user's Telnyx settings
          contactId: contact.id,
          campaignId: campaignIdInt
        })
        
        if (result.success) {
          successCount++
        } else {
          failCount++
          console.error(`Failed to send to ${contact.phone}:`, result.error)
        }
      } catch (error) {
        failCount++
        console.error(`Error sending to ${contact.phone}:`, error)
      }
    }
    
    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaignIdInt },
      data: {
        messagesSent: {
          increment: successCount
        },
        lastMessageSent: new Date()
      }
    })
    
    // Log dedicated send completion
    await serverLog(
      `Dedicated send completed: "${campaign.name}" - ${successCount} sent, ${failCount} failed`,
      successCount > 0 && failCount === 0 ? 'info' : failCount > 0 ? 'warn' : 'error',
      {
        campaignId: campaignIdInt,
        campaignName: campaign.name,
        totalContacts: contacts.length,
        successCount,
        failCount
      },
      userId
    ).catch(err => console.error('Error logging dedicated send completion:', err))
    
    return {
      success: true,
      totalContacts: contacts.length,
      successCount,
      failCount
    }
  } catch (error) {
    console.error('Error executing dedicated send:', error)
    throw error
  }
}
