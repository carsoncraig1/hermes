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
 * Get comprehensive data for multi-level breakdown
 * @param {Object} filters - Filters (dateRange, dimensions)
 * @returns {Promise<Array>} - Raw data items for breakdown
 */
export async function getBreakdownData(filters = {}) {
  try {
    const userId = await getUserId();
    
    const dateFilter = filters.dateRange ? (() => {
      // Handle start date
      const startDate = filters.dateRange.start instanceof Date 
        ? filters.dateRange.start 
        : new Date(filters.dateRange.start);
      
      // Handle end date - ensure it's at end of day
      let endDate;
      if (filters.dateRange.end instanceof Date) {
        endDate = new Date(filters.dateRange.end);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // If it's a string, append time
        const endStr = filters.dateRange.end.includes('T') 
          ? filters.dateRange.end 
          : `${filters.dateRange.end}T23:59:59.999`;
        endDate = new Date(endStr);
      }
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid date range:', filters.dateRange);
        return {};
      }
      
      return {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      };
    })() : {};

    // Get all revenue events with related data
    const revenueEvents = await prisma.revenueEvent.findMany({
      where: {
        userId,
        ...dateFilter
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        shortlink: {
          select: {
            id: true,
            nickname: true
          }
        },
        shortlinkClick: {
          select: {
            id: true,
            messageClickCode: {
              select: {
                contact: {
                  select: {
                    source: true,
                    tags: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            message: {
              select: {
                contact: {
                  select: {
                    source: true,
                    tags: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Get all messages with related data
    const messages = await prisma.message.findMany({
      where: {
        userId,
        direction: 'outbound',
        ...dateFilter
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        contact: {
          select: {
            source: true,
            tags: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Get all campaigns, shortlinks, and tags for labels (needed for mapping)
    const [campaigns, shortlinksForLabels, tags] = await Promise.all([
      prisma.campaign.findMany({
        where: { userId },
        select: {
          id: true,
          name: true
        }
      }),
      prisma.shortlink.findMany({
        where: { userId },
        select: {
          id: true,
          nickname: true
        }
      }),
      prisma.tag.findMany({
        where: { userId },
        select: {
          id: true,
          name: true
        }
      })
    ]);

    const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));
    const shortlinkMap = new Map(shortlinksForLabels.map(s => [s.id, s.nickname || `Shortlink #${s.id}`]));
    const tagMap = new Map(tags.map(t => [t.id, t.name]));

    // Get all shortlinks with click data for processing
    const shortlinksWithClicks = await prisma.shortlink.findMany({
      where: {
        userId
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        clickRecords: {
          where: dateFilter,
          select: {
            id: true,
            createdAt: true,
            messageClickCode: {
              select: {
                contact: {
                  select: {
                    source: true,
                    tags: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            message: {
              select: {
                contact: {
                  select: {
                    source: true,
                    tags: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Transform all data into unified breakdown items
    const allItems = [];

    // Revenue events
    revenueEvents.forEach(event => {
      // Get contact from messageClickCode or message
      const contact = event.shortlinkClick?.messageClickCode?.contact || 
                     event.shortlinkClick?.message?.contact || 
                     null;
      const source = contact?.source || null;
      const tags = contact?.tags || [];
      
      if (tags.length > 0) {
        tags.forEach(tag => {
          allItems.push({
            campaignId: event.campaignId,
            shortlinkId: event.shortlinkId,
            source: source,
            tagId: tag.id,
            tagName: tag.name,
            payout: parseFloat(event.payout),
            createdAt: event.createdAt,
            campaignName: event.campaign?.name || campaignMap.get(event.campaignId) || 'Unknown',
            shortlinkName: event.shortlink?.nickname || shortlinkMap.get(event.shortlinkId) || 'Unknown'
          });
        });
      } else {
        allItems.push({
          campaignId: event.campaignId,
          shortlinkId: event.shortlinkId,
          source: source,
          tagId: null,
          tagName: null,
          payout: parseFloat(event.payout),
          createdAt: event.createdAt,
          campaignName: event.campaign?.name || campaignMap.get(event.campaignId) || 'Unknown',
          shortlinkName: event.shortlink?.nickname || shortlinkMap.get(event.shortlinkId) || 'Unknown'
        });
      }
    });

    // Messages
    messages.forEach(msg => {
      const source = msg.contact?.source || null;
      const tags = msg.contact?.tags || [];
      
      if (tags.length > 0) {
        tags.forEach(tag => {
          allItems.push({
            campaignId: msg.campaignId,
            shortlinkId: null,
            source: source,
            tagId: tag.id,
            tagName: tag.name,
            costAmount: msg.costAmount ? parseFloat(msg.costAmount) : 0,
            status: msg.status,
            direction: msg.direction,
            createdAt: msg.createdAt,
            sentAt: msg.sentAt,
            deliveredAt: msg.deliveredAt,
            campaignName: msg.campaign?.name || campaignMap.get(msg.campaignId) || 'Unknown'
          });
        });
      } else {
        allItems.push({
          campaignId: msg.campaignId,
          shortlinkId: null,
          source: source,
          tagId: null,
          tagName: null,
          costAmount: msg.costAmount ? parseFloat(msg.costAmount) : 0,
          status: msg.status,
          direction: msg.direction,
          createdAt: msg.createdAt,
          sentAt: msg.sentAt,
          deliveredAt: msg.deliveredAt,
          campaignName: msg.campaign?.name || campaignMap.get(msg.campaignId) || 'Unknown'
        });
      }
    });

    // Shortlink clicks
    shortlinksWithClicks.forEach(shortlink => {
      shortlink.clickRecords.forEach(click => {
        // Get contact from messageClickCode or message
        const contact = click.messageClickCode?.contact || 
                       click.message?.contact || 
                       null;
        const source = contact?.source || null;
        const tags = contact?.tags || [];
        
        if (tags.length > 0) {
          tags.forEach(tag => {
            allItems.push({
              campaignId: shortlink.campaignId,
              shortlinkId: shortlink.id,
              source: source,
              tagId: tag.id,
              tagName: tag.name,
              clicks: 1,
              createdAt: click.createdAt,
              campaignName: shortlink.campaign?.name || campaignMap.get(shortlink.campaignId) || 'Unknown',
              shortlinkName: shortlink.nickname || shortlinkMap.get(shortlink.id) || 'Unknown'
            });
          });
        } else {
          allItems.push({
            campaignId: shortlink.campaignId,
            shortlinkId: shortlink.id,
            source: source,
            tagId: null,
            tagName: null,
            clicks: 1,
            createdAt: click.createdAt,
            campaignName: shortlink.campaign?.name || campaignMap.get(shortlink.campaignId) || 'Unknown',
            shortlinkName: shortlink.nickname || shortlinkMap.get(shortlink.id) || 'Unknown'
          });
        }
      });
    });

    return allItems;
  } catch (error) {
    console.error('Error fetching breakdown data:', error);
    throw error;
  }
}

/**
 * Get available dimension values (campaigns, shortlinks, sources, tags)
 */
export async function getDimensionValues() {
  try {
    const userId = await getUserId();

    const [campaigns, shortlinks, contacts, tags] = await Promise.all([
      prisma.campaign.findMany({
        where: { userId },
        select: { id: true, name: true }
      }),
      prisma.shortlink.findMany({
        where: { userId },
        select: { id: true, nickname: true }
      }),
      prisma.contact.findMany({
        where: { userId },
        select: { source: true },
        distinct: ['source']
      }),
      prisma.tag.findMany({
        where: { userId },
        select: { id: true, name: true }
      })
    ]);

    return {
      campaigns: campaigns.map(c => ({ id: c.id, name: c.name })),
      shortlinks: shortlinks.map(s => ({ id: s.id, name: s.nickname || `Shortlink #${s.id}` })),
      sources: contacts.map(c => c.source).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i),
      tags: tags.map(t => ({ id: t.id, name: t.name }))
    };
  } catch (error) {
    console.error('Error fetching dimension values:', error);
    throw error;
  }
}

