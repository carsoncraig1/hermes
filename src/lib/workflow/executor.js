'use server';

import prisma from '@/lib/prisma';
import { sendMessage as telnyxSendMessage } from '@/lib/telnyx';
import { serverLog } from '@/lib/serverLogger';

// Resolve shortlink URLs in message text
async function resolveShortlinkUrls(messageText, userId) {
  if (!messageText) return messageText;
  
  // Find all shortlink URLs in the message
  const regex = /https:\/\/txt\.cx\/([a-zA-Z0-9_-]+)/g;
  let resolvedMessage = messageText;
  const matches = [...messageText.matchAll(regex)];
  
  // For each shortlink, we keep the URL as-is (it will be tracked when clicked)
  // But we could potentially replace with destination if needed
  // For now, we'll keep the shortlink URL for tracking purposes
  return resolvedMessage;
}

// Send message function with real Telnyx integration
async function sendMessage(contact, messageText, userId, campaignId = null) {
  if (!contact.phone || !messageText) {
    console.error('Missing phone or message text');
    return { success: false, error: 'Missing phone or message text' };
  }

  // Enforce subscription check - only send to subscribed contacts
  if (!contact.subscribed) {
    console.log(`Skipping message to unsubscribed contact: ${contact.phone}`);
    return { success: false, error: 'Contact is not subscribed' };
  }

  try {
    // Resolve shortlink URLs (keep them for tracking)
    const resolvedMessage = await resolveShortlinkUrls(messageText, userId);
    
    // Get user's standard opt-out text if set
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { standardOptOutText: true }
    });
    
    // Build the message with opt-out text if available
    let finalMessage = resolvedMessage;
    if (user?.standardOptOutText) {
      finalMessage = `${resolvedMessage}\n\n${user.standardOptOutText}`;
    }
    
    // Send via Telnyx with contact and campaign IDs for tracking
    const result = await telnyxSendMessage({
      to: contact.phone,
      text: finalMessage,
      userId: userId,
      contactId: contact.id,
      campaignId: campaignId
    });
    
    // Update campaign stats if campaignId is provided
    if (campaignId && result.success) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          messagesSent: { increment: 1 },
          lastMessageSent: new Date()
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
}

// Evaluate segmentation conditions
async function evaluateConditions(contact, conditions, userId, campaignId = null) {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means all pass
  }

  // Check all conditions - some may need async database queries
  const conditionResults = await Promise.all(
    conditions.map(async (condition) => {
      const { field, operator, value } = condition;
      if (!field || !value) return true; // Skip incomplete conditions

      // Handle special fields that require database queries
      if (field === 'clicked') {
        return await evaluateClickCondition(contact.id, userId, campaignId, value);
      }
      
      if (field === 'opened') {
        return await evaluateOpenCondition(contact.id, userId, campaignId, value);
      }

      // Handle regular contact fields
      const contactValue = contact[field];

      // Handle array fields
      if (Array.isArray(contactValue)) {
        const searchValue = value.toLowerCase();
        const contactStr = contactValue.join(' ').toLowerCase();
        switch (operator) {
          case 'equals':
            return contactStr === searchValue;
          case 'contains':
            return contactStr.includes(searchValue);
          case 'notEquals':
            return contactStr !== searchValue;
          default:
            return false;
        }
      }

      // Handle boolean fields
      if (typeof contactValue === 'boolean') {
        const boolValue = value.toLowerCase() === 'true' || value === '1';
        switch (operator) {
          case 'equals':
            return contactValue === boolValue;
          case 'notEquals':
            return contactValue !== boolValue;
          default:
            return false;
        }
      }

      // Handle string fields
      const contactStr = String(contactValue || '').toLowerCase();
      const searchStr = String(value || '').toLowerCase();

      switch (operator) {
        case 'equals':
          return contactStr === searchStr;
        case 'contains':
          return contactStr.includes(searchStr);
        case 'notEquals':
          return contactStr !== searchStr;
        default:
          return false;
      }
    })
  );

  // All conditions must pass (AND logic)
  return conditionResults.every(result => result === true);
}

// Evaluate click condition
async function evaluateClickCondition(contactId, userId, campaignId, value) {
  const now = new Date();
  let whereClause = {
    messageClickCode: {
      contactId: contactId,
      userId: userId
    }
  };

  // Add time-based filters
  switch (value) {
    case 'never':
      // Check if contact has any clicks
      const hasClicks = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId
          }
        }
      });
      return hasClicks === 0;

    case 'ever':
      // Check if contact has any clicks ever
      const hasAnyClicks = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId
          }
        }
      });
      return hasAnyClicks > 0;

    case 'within_campaign':
      // Check if contact clicked within this campaign
      if (!campaignId) return false;
      const campaignClicks = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId,
            message: {
              campaignId: campaignId
            }
          }
        }
      });
      return campaignClicks > 0;

    case 'within_last_message':
      // Check if contact clicked on the most recent message sent to them
      const lastMessage = await prisma.message.findFirst({
        where: {
          contactId: contactId,
          userId: userId,
          direction: 'outbound'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: { id: true }
      });
      
      if (!lastMessage) return false;
      
      const lastMessageClicks = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId,
            messageId: lastMessage.id
          }
        }
      });
      return lastMessageClicks > 0;

    case 'within_24h':
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const clicks24h = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId
          },
          createdAt: {
            gte: dayAgo
          }
        }
      });
      return clicks24h > 0;

    case 'within_7d':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const clicks7d = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId
          },
          createdAt: {
            gte: weekAgo
          }
        }
      });
      return clicks7d > 0;

    case 'within_30d':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const clicks30d = await prisma.shortlinkClick.count({
        where: {
          messageClickCode: {
            contactId: contactId,
            userId: userId
          },
          createdAt: {
            gte: monthAgo
          }
        }
      });
      return clicks30d > 0;

    default:
      return false;
  }
}

// Evaluate open condition (message preview opens)
// Opens are tracked per MessageClickCode when bots fetch the preview
async function evaluateOpenCondition(contactId, userId, campaignId, value) {
  const now = new Date();
  
  switch (value) {
    case 'never':
      // Check if contact has any opened MessageClickCodes
      const hasAnyOpens = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          opened: true
        }
      });
      return hasAnyOpens === 0;

    case 'ever':
      // Check if contact has any opened MessageClickCodes
      const hasOpens = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          opened: true
        }
      });
      return hasOpens > 0;

    case 'within_campaign':
      if (!campaignId) return false;
      // Check if any MessageClickCodes in campaign messages have been opened
      const campaignMessages = await prisma.message.findMany({
        where: {
          contactId: contactId,
          userId: userId,
          campaignId: campaignId,
          direction: 'outbound'
        },
        select: { id: true }
      });
      
      if (campaignMessages.length === 0) return false;
      
      const messageIds = campaignMessages.map(m => m.id);
      const campaignOpens = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          messageId: { in: messageIds },
          opened: true
        }
      });
      return campaignOpens > 0;

    case 'within_last_message':
      const lastMessage = await prisma.message.findFirst({
        where: {
          contactId: contactId,
          userId: userId,
          direction: 'outbound'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: { id: true }
      });
      
      if (!lastMessage) return false;
      
      const lastMessageOpens = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          messageId: lastMessage.id,
          opened: true
        }
      });
      return lastMessageOpens > 0;

    case 'within_24h':
      // Check if MessageClickCodes opened in last 24h
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const opens24h = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          opened: true,
          openedAt: {
            gte: dayAgo
          }
        }
      });
      return opens24h > 0;

    case 'within_7d':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const opens7d = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          opened: true,
          openedAt: {
            gte: weekAgo
          }
        }
      });
      return opens7d > 0;

    case 'within_30d':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const opens30d = await prisma.messageClickCode.count({
        where: {
          contactId: contactId,
          userId: userId,
          opened: true,
          openedAt: {
            gte: monthAgo
          }
        }
      });
      return opens30d > 0;

    default:
      return false;
  }
}

// Execute a workflow for a contact
export async function executeWorkflow(workflow, contact, userId, campaignId = null) {
  if (!workflow || !workflow.nodes || !workflow.edges) {
    await serverLog(
      'Invalid workflow structure',
      'error',
      { campaignId, contactId: contact?.id },
      userId
    ).catch(() => {});
    console.error('Invalid workflow structure');
    return;
  }

  const { nodes, edges } = workflow;

  // Find the trigger node (should be the starting point)
  const triggerNode = nodes.find((node) => node.type === 'trigger');
  if (!triggerNode) {
    await serverLog(
      'No trigger node found in workflow',
      'error',
      { campaignId, contactId: contact?.id },
      userId
    ).catch(() => {});
    console.error('No trigger node found in workflow');
    return;
  }

  // Log workflow execution start
  await serverLog(
    `Workflow execution started for contact ${contact.phone}`,
    'info',
    {
      campaignId,
      contactId: contact.id,
      contactPhone: contact.phone,
      nodesCount: nodes.length,
      edgesCount: edges.length
    },
    userId
  ).catch(err => console.error('Error logging workflow start:', err));

  // Build adjacency list for graph traversal with edge IDs
  // Map: sourceNodeId -> [{ targetNodeId, sourceHandle, targetHandle }]
  const graph = new Map();
  edges.forEach((edge) => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source).push({
      target: edge.target,
      sourceHandle: edge.sourceHandle, // e.g., "source-true", "source-false", "source"
      targetHandle: edge.targetHandle
    });
  });

  // Execute workflow starting from trigger
  // Use a queue-based approach where delays are handled asynchronously
  const visited = new Set();
  const scheduledNodes = new Map(); // Track scheduled node executions
  
  // Process node immediately or schedule it
  const processNode = async (nodeId, delayMs = 0) => {
    if (visited.has(nodeId)) return;
    
    // If there's a delay, schedule it asynchronously (non-blocking)
    if (delayMs > 0) {
      const timeoutId = setTimeout(async () => {
        await executeNode(nodeId);
      }, delayMs);
      scheduledNodes.set(nodeId, timeoutId);
      return;
    }
    
    // No delay, execute immediately
    await executeNode(nodeId);
  };

  // Execute a single node
  const executeNode = async (nodeId) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const currentNode = nodes.find((n) => n.id === nodeId);
    if (!currentNode) return;

    // Execute node based on type
    switch (currentNode.type) {
      case 'trigger':
        // Trigger node - just continue to next nodes
        break;

      case 'segmentation':
        // Check if contact matches conditions
        const conditions = currentNode.data?.conditions || [];
        const matches = await evaluateConditions(contact, conditions, userId, campaignId);
        
        // Log segmentation result
        await serverLog(
          `Workflow segmentation node evaluated: ${matches ? 'Contact matches criteria' : 'Contact does not match criteria'}`,
          'info',
          {
            campaignId,
            contactId: contact.id,
            contactPhone: contact.phone,
            nodeId: nodeId,
            nodeType: 'segmentation',
            matches,
            conditionsCount: conditions.length
          },
          userId
        ).catch(err => console.error('Error logging segmentation:', err));
        
        // Get connected edges for this segmentation node
        const segmentationEdges = graph.get(nodeId) || [];
        
        // Route based on match result and edge sourceHandle
        for (const edge of segmentationEdges) {
          const shouldFollow = 
            (matches && edge.sourceHandle === 'source-true') || // YES path
            (!matches && edge.sourceHandle === 'source-false'); // NO path
          
          if (shouldFollow && !visited.has(edge.target)) {
            await processNode(edge.target, 0);
          }
        }
        
        // Don't add nodes below - we've already handled routing
        return;

      case 'action':
        // Execute action
        if (currentNode.data?.message) {
          const sendResult = await sendMessage(contact, currentNode.data.message, userId, campaignId);
          
          // Log action node execution
          await serverLog(
            `Workflow action node executed: ${sendResult.success ? 'Message sent' : 'Message failed'}`,
            sendResult.success ? 'info' : 'error',
            {
              campaignId,
              contactId: contact.id,
              contactPhone: contact.phone,
              nodeId: nodeId,
              nodeType: 'action',
              success: sendResult.success,
              error: sendResult.error
            },
            userId
          ).catch(err => console.error('Error logging workflow action:', err));
        }
        break;

      case 'delay':
        // Delay node - extract delay value and unit
        const delayValue = parseInt(currentNode.data?.delayValue || '0', 10);
        const delayUnit = currentNode.data?.delayUnit || 'minutes';
        
        // Convert to milliseconds
        let delayMs = 0;
        if (delayUnit === 'hours') {
          delayMs = delayValue * 60 * 60 * 1000;
        } else {
          delayMs = delayValue * 60 * 1000; // minutes
        }
        
        // Log delay node execution
        await serverLog(
          `Workflow delay node executed: ${delayValue} ${delayUnit}`,
          'info',
          {
            campaignId,
            contactId: contact.id,
            contactPhone: contact.phone,
            nodeId: nodeId,
            nodeType: 'delay',
            delayValue,
            delayUnit,
            delayMs
          },
          userId
        ).catch(err => console.error('Error logging delay:', err));
        
        // Schedule next nodes with the delay
        const delayEdges = graph.get(nodeId) || [];
        for (const edge of delayEdges) {
          if (!visited.has(edge.target)) {
            await processNode(edge.target, delayMs);
          }
        }
        
        // Don't add nodes below - we've already handled delay propagation
        return;

      default:
        console.warn(`Unknown node type: ${currentNode.type}`);
    }

    // Add connected nodes to process (for non-segmentation, non-delay nodes)
    const nextEdges = graph.get(nodeId) || [];
    for (const edge of nextEdges) {
      if (!visited.has(edge.target)) {
        await processNode(edge.target, 0);
      }
    }
  };

  // Start processing from the trigger node
  await processNode(triggerNode.id, 0);
}

// Trigger workflows for a new contact
export async function triggerWorkflowsForContact(contact, userId) {
  try {
    // Enforce subscription check - only trigger workflows for subscribed contacts
    if (!contact.subscribed) {
      console.log(`Skipping workflow execution for unsubscribed contact: ${contact.phone}`);
      return;
    }

    // Find all enabled campaigns with workflows for this user
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        enabled: true,
        workflow: { not: null },
      },
    });

    // Filter workflows by source before executing
    const contactSource = contact.source || null;
    
    // Categorize workflows by trigger type
    const specificSourceCampaigns = [];
    const defaultCampaigns = [];
    const catchAllCampaigns = [];
    
    campaigns.forEach(campaign => {
      if (!campaign.workflow || !campaign.workflow.nodes) {
        return;
      }

      // Find the trigger node
      const triggerNode = campaign.workflow.nodes.find(node => node.type === 'trigger');
      if (!triggerNode) {
        return;
      }

      // Skip manual fire triggers - they are only executed manually
      const triggerType = triggerNode.data?.triggerType || 'newLead';
      if (triggerType === 'manualFire') {
        return;
      }

      // Get the trigger source configuration
      const triggerSource = triggerNode.data?.triggerSource;

      // Categorize based on trigger type
      if (triggerSource === null || triggerSource === undefined) {
        // Catch-all: fires on every lead
        catchAllCampaigns.push(campaign);
      } else if (triggerSource === '__DEFAULT__') {
        // Default: only fires if no specific source match
        defaultCampaigns.push(campaign);
      } else {
        // Specific source: only fires if source matches
        if (triggerSource === contactSource) {
          specificSourceCampaigns.push(campaign);
        }
      }
    });

    // Execution order:
    // 1. Specific source workflows (highest priority)
    // 2. Default workflows (only if no specific source match was found)
    // 3. Catch-all workflows (always fire)
    
    const campaignsToExecute = [
      ...specificSourceCampaigns,
      ...(specificSourceCampaigns.length === 0 ? defaultCampaigns : []), // Only default if no specific match
      ...catchAllCampaigns // Always include catch-all
    ];

    // Execute workflows in priority order
    for (const campaign of campaignsToExecute) {
      if (campaign.workflow) {
        try {
          // Log workflow trigger
          const triggerType = specificSourceCampaigns.includes(campaign) ? 'specific_source' : 
                             defaultCampaigns.includes(campaign) ? 'default' : 'catch_all';
          
          await serverLog(
            `Workflow triggered for new lead: ${contact.phone}`,
            'info',
            {
              campaignId: campaign.id,
              campaignName: campaign.name,
              contactId: contact.id,
              contactPhone: contact.phone,
              contactSource: contact.source,
              triggerType
            },
            userId
          ).catch(err => console.error('Error logging workflow trigger:', err));
          
          await executeWorkflow(campaign.workflow, contact, userId, campaign.id);
        } catch (error) {
          await serverLog(
            `Error executing workflow for campaign ${campaign.id}: ${error.message}`,
            'error',
            {
              campaignId: campaign.id,
              campaignName: campaign.name,
              contactId: contact.id,
              error: error.message
            },
            userId
          ).catch(err => console.error('Error logging workflow error:', err));
          console.error(`Error executing workflow for campaign ${campaign.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error triggering workflows:', error);
  }
}

