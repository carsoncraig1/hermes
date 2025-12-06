'use server';

import prisma from '@/lib/prisma';

// Placeholder send message function
async function sendMessage(contact, messageText) {
  // TODO: Implement actual message sending
  console.log(`[PLACEHOLDER] Would send message to ${contact.phone}: ${messageText}`);
  return { success: true, messageId: `placeholder-${Date.now()}` };
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
export async function executeWorkflow(workflow, contact, userId) {
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

  // Build adjacency list for graph traversal
  const graph = new Map();
  edges.forEach((edge) => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source).push(edge.target);
  });

  // Execute workflow starting from trigger
  const visited = new Set();
  const queue = [triggerNode.id];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
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
        
        if (!matches) {
          // Contact doesn't match, stop this path
          // Don't add connected nodes to queue
          continue;
        }
        // Contact matches, continue to next nodes (they'll be added below)
        break;

      case 'action':
        // Execute action
        if (currentNode.data?.message) {
          await sendMessage(contact, currentNode.data.message);
        }
        break;

      default:
        console.warn(`Unknown node type: ${currentNode.type}`);
    }

    // Add connected nodes to queue
    const nextNodes = graph.get(currentNodeId) || [];
    nextNodes.forEach((nextNodeId) => {
      if (!visited.has(nextNodeId)) {
        queue.push(nextNodeId);
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
          await executeWorkflow(campaign.workflow, contact, userId);
        } catch (error) {
          console.error(`Error executing workflow for campaign ${campaign.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error triggering workflows:', error);
  }
}

