'use server'
import { prisma } from '@/lib/prisma'

export async function createCampaign({ name, targetAllSubscribed, selectedTags }) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Create the campaign
      const campaign = await tx.campaign.create({
        data: {
          name,
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

      return campaign
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