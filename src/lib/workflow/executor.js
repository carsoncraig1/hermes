'use server';

import prisma from '@/lib/prisma';
import { sendMessage as telnyxSendMessage } from '@/lib/telnyx';

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
function evaluateConditions(contact, conditions) {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means all pass
  }

  return conditions.every((condition) => {
    const { field, operator, value } = condition;
    if (!field || !value) return true; // Skip incomplete conditions

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
  });
}

// Execute a workflow for a contact
export async function executeWorkflow(workflow, contact, userId, campaignId = null) {
  if (!workflow || !workflow.nodes || !workflow.edges) {
    console.error('Invalid workflow structure');
    return;
  }

  const { nodes, edges } = workflow;

  // Find the trigger node (should be the starting point)
  const triggerNode = nodes.find((node) => node.type === 'trigger');
  if (!triggerNode) {
    console.error('No trigger node found in workflow');
    return;
  }

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
  const visited = new Set();
  const queue = [{ nodeId: triggerNode.id, delay: 0 }]; // Add delay tracking

  while (queue.length > 0) {
    const { nodeId: currentNodeId, delay: currentDelay } = queue.shift();
    
    // Apply delay if needed
    if (currentDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
    
    if (visited.has(currentNodeId)) continue;
    visited.add(currentNodeId);

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) continue;

    // Execute node based on type
    switch (currentNode.type) {
      case 'trigger':
        // Trigger node - just continue to next nodes
        break;

      case 'segmentation':
        // Check if contact matches conditions
        const conditions = currentNode.data?.conditions || [];
        const matches = evaluateConditions(contact, conditions);
        
        // Get connected edges for this segmentation node
        const segmentationEdges = graph.get(currentNodeId) || [];
        
        // Route based on match result and edge sourceHandle
        segmentationEdges.forEach((edge) => {
          const shouldFollow = 
            (matches && edge.sourceHandle === 'source-true') || // YES path
            (!matches && edge.sourceHandle === 'source-false'); // NO path
          
          if (shouldFollow && !visited.has(edge.target)) {
            queue.push({ nodeId: edge.target, delay: 0 });
          }
        });
        
        // Don't add nodes below - we've already handled routing
        continue;

      case 'action':
        // Execute action
        if (currentNode.data?.message) {
          await sendMessage(contact, currentNode.data.message, userId, campaignId);
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
        
        // Pass delay to next nodes
        const delayEdges = graph.get(currentNodeId) || [];
        delayEdges.forEach((edge) => {
          if (!visited.has(edge.target)) {
            queue.push({ nodeId: edge.target, delay: delayMs });
          }
        });
        
        // Don't add nodes below - we've already handled delay propagation
        continue;

      default:
        console.warn(`Unknown node type: ${currentNode.type}`);
    }

    // Add connected nodes to queue (for non-segmentation, non-delay nodes)
    const nextEdges = graph.get(currentNodeId) || [];
    nextEdges.forEach((edge) => {
      if (!visited.has(edge.target)) {
        queue.push({ nodeId: edge.target, delay: 0 });
      }
    });
  }
}

// Trigger workflows for a new contact
export async function triggerWorkflowsForContact(contact, userId) {
  try {
    // Find all enabled campaigns with workflows for this user
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        enabled: true,
        workflow: { not: null },
      },
    });

    // Execute each workflow
    for (const campaign of campaigns) {
      if (campaign.workflow) {
        try {
          await executeWorkflow(campaign.workflow, contact, userId, campaign.id);
        } catch (error) {
          console.error(`Error executing workflow for campaign ${campaign.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error triggering workflows:', error);
  }
}

