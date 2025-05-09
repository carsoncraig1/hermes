'use server'
import prisma from '@/lib/prisma'

export async function createCampaign({ name, message, targetAllSubscribed, selectedTags, numbers }) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Create the campaign
      const campaign = await tx.campaign.create({
        data: {
          name,
          message,
          numbers: numbers && numbers.length > 0 ? { connect: numbers.map(id => ({ id })) } : undefined,
        },
        include: {
          targets: {
            include: {
              tag: true
            }
          },
          shortlinks: true,
          numbers: true
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
          shortlinks: true,
          numbers: true
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
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      targets: {
        include: {
          tag: true
        }
      }
    }
  })

  if (!campaign) throw new Error('Campaign not found')

  // If any target is ALL_SUBSCRIBED, get all subscribed contacts
  if (campaign.targets.some(target => target.targetType === 'ALL_SUBSCRIBED')) {
    return await prisma.contact.findMany({
      where: {
        subscribed: true
      }
    })
  }

  // Otherwise, get contacts with matching tags
  const tagIds = campaign.targets
    .filter(target => target.targetType === 'TAG')
    .map(target => target.tagId)

  return await prisma.contact.findMany({
    where: {
      subscribed: true,
      tags: {
        some: {
          id: {
            in: tagIds
          }
        }
      }
    }
  })
}

export async function getCampaigns() {
  try {
    const campaigns = await prisma.campaign.findMany({
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
    await prisma.campaign.delete({
      where: { id }
    })
    return true
  } catch (error) {
    console.error('Error deleting campaign:', error)
    throw new Error('Failed to delete campaign')
  }
}

export async function updateCampaign({ id, name, message, targetAllSubscribed, selectedTags, numbers }) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Update the campaign
      const campaign = await tx.campaign.update({
        where: { id },
        data: {
          name,
          message,
          numbers: numbers && numbers.length > 0 ? { set: numbers.map(numId => ({ id: numId })) } : { set: [] },
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
          shortlinks: true,
          numbers: true
        }
      })
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    throw error
  }
} 