'use server';

import { auth } from '@/lib/auth';
import { getMessageAnalytics, getCampaignPerformance } from '@/lib/actions/messages';
import prisma from '@/lib/prisma';

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}

/**
 * Get message analytics for the current user
 * @param {Object} filters - Optional filters (campaignId, dateRange)
 * @returns {Promise<Object>} - Analytics data
 */
export async function getAnalytics(filters = {}) {
  try {
    const userId = await getUserId();
    return await getMessageAnalytics(userId, filters);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}

/**
 * Get campaign performance metrics
 * @param {number} campaignId - Campaign ID
 * @returns {Promise<Object>} - Campaign performance data
 */
export async function getCampaignAnalytics(campaignId) {
  try {
    const userId = await getUserId();
    
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId }
    });
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    return await getCampaignPerformance(campaignId);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    throw error;
  }
}

/**
 * Get delivery status summary for campaigns
 * @returns {Promise<Array>} - Array of campaign delivery summaries
 */
export async function getCampaignDeliveryStatus() {
  try {
    const userId = await getUserId();
    
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        messages: {
          select: {
            status: true,
            costAmount: true
          }
        }
      }
    });
    
    return campaigns.map(campaign => {
      const messages = campaign.messages;
      const total = messages.length;
      const delivered = messages.filter(m => m.status === 'delivered').length;
      const failed = messages.filter(m => 
        m.status === 'sending_failed' || m.status === 'delivery_failed'
      ).length;
      const sent = messages.filter(m => m.status === 'sent').length;
      const queued = messages.filter(m => m.status === 'queued' || m.status === 'sending').length;
      
      const totalCost = messages.reduce((sum, m) => {
        return sum + (m.costAmount ? parseFloat(m.costAmount) : 0);
      }, 0);
      
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        total,
        delivered,
        failed,
        sent,
        queued,
        deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
        totalCost: parseFloat(totalCost.toFixed(4))
      };
    });
  } catch (error) {
    console.error('Error fetching campaign delivery status:', error);
    throw error;
  }
}

