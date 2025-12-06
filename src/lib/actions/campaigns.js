'use server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function createCampaign({ name, message, targetAllSubscribed, selectedTags, selectedSources, workflow }) {
  try {
    const userId = await getUserId()
    
    // If workflow is provided, create workflow-based campaign
    if (workflow) {
      const campaign = await prisma.campaign.create({
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
      return campaign
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
        // Create a target for each selected tag
        await tx.campaignTarget.createMany({
          data: selectedTags.map(tagId => ({
            campaignId: campaign.id,
            targetType: 'TAG',
            tagId
          }))
        })
      }

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
        shortlinks: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    return campaigns
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

export async function updateCampaign({ id, name, message, targetAllSubscribed, selectedTags }) {
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
        await tx.campaignTarget.createMany({
          data: selectedTags.map(tagId => ({
            campaignId: id,
            targetType: 'TAG',
            tagId
          }))
        })
      }

      // Return updated campaign with relations
      return await tx.campaign.findUnique({
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
    
    // Update the workflow campaign
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name,
        workflow: workflow,
      },
      include: {
        shortlinks: true
      }
    })
    
    return campaign
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
    const campaigns = allCampaigns.filter(campaign => campaign.workflow === null)
    
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
    
    // Import sendMessage from telnyx
    const { sendMessage } = await import('@/lib/telnyx')
    
    // Get the sender phone number from environment variable
    // Default to a placeholder if not set (you may want to add this to user settings)
    const fromNumber = process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_FROM_NUMBER || '+15551234567'
    
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
          from: fromNumber,
          to: contact.phone,
          text: messageText
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
