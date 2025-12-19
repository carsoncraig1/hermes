/**
 * Multi-level breakdown analytics engine
 * Similar to Everflow's reporting system
 */

/**
 * Available dimensions for breakdown
 */
export const DIMENSIONS = {
  CAMPAIGN: 'campaign',
  SHORTLINK: 'shortlink',
  SOURCE: 'source',
  TAG: 'tag',
  DATE: 'date',
  DATE_WEEK: 'date_week',
  DATE_MONTH: 'date_month',
  MESSAGE_STATUS: 'message_status',
  MESSAGE_DIRECTION: 'message_direction',
  NONE: 'none'
};

/**
 * Available metrics
 */
export const METRICS = {
  CONTACTS: 'contacts',
  COST: 'cost',
  CLICKS: 'clicks',
  CPC: 'cpc',
  REVENUE: 'revenue',
  ROAS: 'roas',
  CONVERSION_RATE: 'conversion_rate',
  EPC: 'epc',
  MESSAGES_SENT: 'messages_sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  OPENS: 'opens'
};

/**
 * Get dimension label
 */
export function getDimensionLabel(dimension) {
  const labels = {
    [DIMENSIONS.CAMPAIGN]: 'Campaign',
    [DIMENSIONS.SHORTLINK]: 'Shortlink',
    [DIMENSIONS.SOURCE]: 'Source',
    [DIMENSIONS.TAG]: 'Tag',
    [DIMENSIONS.DATE]: 'Date',
    [DIMENSIONS.DATE_WEEK]: 'Week',
    [DIMENSIONS.DATE_MONTH]: 'Month',
    [DIMENSIONS.MESSAGE_STATUS]: 'Message Status',
    [DIMENSIONS.MESSAGE_DIRECTION]: 'Direction',
    [DIMENSIONS.NONE]: 'None'
  };
  return labels[dimension] || dimension;
}

/**
 * Get metric label
 */
export function getMetricLabel(metric) {
  const labels = {
    [METRICS.CONTACTS]: 'Contacts',
    [METRICS.COST]: 'Cost',
    [METRICS.CLICKS]: 'Clicks',
    [METRICS.CPC]: 'CPC',
    [METRICS.REVENUE]: 'Revenue',
    [METRICS.ROAS]: 'ROAS',
    [METRICS.CONVERSION_RATE]: 'Conv. Rate',
    [METRICS.EPC]: 'EPC',
    [METRICS.MESSAGES_SENT]: 'Messages',
    [METRICS.DELIVERED]: 'Delivered',
    [METRICS.FAILED]: 'Failed',
    [METRICS.OPENS]: 'Opens'
  };
  return labels[metric] || metric;
}

/**
 * Format date for grouping
 */
export function formatDateForGrouping(date, dimension) {
  const d = new Date(date);
  
  switch (dimension) {
    case DIMENSIONS.DATE:
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    case DIMENSIONS.DATE_WEEK:
      // Get week number and year
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
      return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 6) / 7)).padStart(2, '0')}`;
    case DIMENSIONS.DATE_MONTH:
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    default:
      return d.toISOString().split('T')[0];
  }
}

/**
 * Get label from item data
 */
function getItemLabel(item, dimension) {
  switch (dimension) {
    case DIMENSIONS.CAMPAIGN:
      return item.campaignName;
    case DIMENSIONS.SHORTLINK:
      return item.shortlinkName;
    case DIMENSIONS.TAG:
      return item.tagName;
    default:
      return null;
  }
}

/**
 * Format date label for display
 */
export function formatDateLabel(dateKey, dimension) {
  switch (dimension) {
    case DIMENSIONS.DATE:
      return new Date(dateKey).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    case DIMENSIONS.DATE_WEEK:
      const [year, week] = dateKey.split('-W');
      return `Week ${week}, ${year}`;
    case DIMENSIONS.DATE_MONTH:
      const [y, m] = dateKey.split('-');
      return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric'
      });
    default:
      return dateKey;
  }
}

/**
 * Build breakdown tree structure
 * @param {Array} data - Raw data array
 * @param {Array} dimensions - Array of dimension keys [level1, level2, level3]
 * @param {Object} options - Options for breakdown
 * @returns {Object} - Breakdown tree structure
 */
export function buildBreakdownTree(data, dimensions, options = {}) {
  const { dateRange, metrics = Object.values(METRICS) } = options;
  
  // Filter data by date range if provided
  let filteredData = data;
  if (dateRange) {
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end + 'T23:59:59').getTime();
    filteredData = data.filter(item => {
      const itemDate = new Date(item.createdAt || item.sentAt || item.deliveredAt).getTime();
      return itemDate >= start && itemDate <= end;
    });
  }

  // Build nested breakdown
  const breakdown = {};
  const dimension1 = dimensions[0] || DIMENSIONS.NONE;
  const dimension2 = dimensions[1] || DIMENSIONS.NONE;
  const dimension3 = dimensions[2] || DIMENSIONS.NONE;

  filteredData.forEach(item => {
    // Get keys for each dimension level
    const key1 = getDimensionKey(item, dimension1);
    const key2 = dimension2 !== DIMENSIONS.NONE ? getDimensionKey(item, dimension2) : null;
    const key3 = dimension3 !== DIMENSIONS.NONE ? getDimensionKey(item, dimension3) : null;

    // Get labels from item data if available
    const label1 = getItemLabel(item, dimension1) || getDimensionLabelForKey(key1, dimension1);
    const label2 = key2 ? (getItemLabel(item, dimension2) || getDimensionLabelForKey(key2, dimension2)) : null;
    const label3 = key3 ? (getItemLabel(item, dimension3) || getDimensionLabelForKey(key3, dimension3)) : null;

    // Initialize breakdown structure
    if (!breakdown[key1]) {
      breakdown[key1] = {
        key: key1,
        label: label1,
        dimension: dimension1,
        children: {},
        metrics: initializeMetrics()
      };
    }

    // Level 2
    if (key2 !== null) {
      if (!breakdown[key1].children[key2]) {
        breakdown[key1].children[key2] = {
          key: key2,
          label: label2,
          dimension: dimension2,
          children: {},
          metrics: initializeMetrics()
        };
      }

      // Level 3
      if (key3 !== null) {
        if (!breakdown[key1].children[key2].children[key3]) {
          breakdown[key1].children[key2].children[key3] = {
            key: key3,
            label: label3,
            dimension: dimension3,
            metrics: initializeMetrics()
          };
        }
        aggregateMetrics(breakdown[key1].children[key2].children[key3].metrics, item);
      } else {
        aggregateMetrics(breakdown[key1].children[key2].metrics, item);
      }
    } else {
      aggregateMetrics(breakdown[key1].metrics, item);
    }
  });

  // Calculate derived metrics
  calculateDerivedMetrics(breakdown);

  return breakdown;
}

/**
 * Get dimension key from data item
 */
function getDimensionKey(item, dimension) {
  switch (dimension) {
    case DIMENSIONS.CAMPAIGN:
      return item.campaignId ? `campaign_${item.campaignId}` : 'no_campaign';
    case DIMENSIONS.SHORTLINK:
      return item.shortlinkId ? `shortlink_${item.shortlinkId}` : 'no_shortlink';
    case DIMENSIONS.SOURCE:
      return item.source || 'no_source';
    case DIMENSIONS.TAG:
      return item.tagId ? `tag_${item.tagId}` : 'no_tag';
    case DIMENSIONS.DATE:
    case DIMENSIONS.DATE_WEEK:
    case DIMENSIONS.DATE_MONTH:
      return formatDateForGrouping(item.createdAt || item.sentAt || item.deliveredAt || new Date(), dimension);
    case DIMENSIONS.MESSAGE_STATUS:
      return item.status || 'unknown';
    case DIMENSIONS.MESSAGE_DIRECTION:
      return item.direction || 'unknown';
    default:
      return 'all';
  }
}

/**
 * Get label for dimension key
 * Note: This will be enhanced with actual names from the data
 */
function getDimensionLabelForKey(key, dimension) {
  if (key === 'all') return 'All';
  if (key === 'no_campaign') return 'No Campaign';
  if (key === 'no_shortlink') return 'No Shortlink';
  if (key === 'no_source') return 'No Source';
  if (key === 'no_tag') return 'No Tag';
  if (key === 'unknown') return 'Unknown';

  switch (dimension) {
    case DIMENSIONS.DATE:
    case DIMENSIONS.DATE_WEEK:
    case DIMENSIONS.DATE_MONTH:
      return formatDateLabel(key, dimension);
    case DIMENSIONS.SOURCE:
      return key;
    case DIMENSIONS.MESSAGE_STATUS:
      return key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ');
    case DIMENSIONS.MESSAGE_DIRECTION:
      return key.charAt(0).toUpperCase() + key.slice(1);
    default:
      // For campaign/shortlink/tag, we'll use the name from the item
      // This is a fallback - actual names should come from item data
      const parts = key.split('_');
      return parts.length > 1 ? parts.slice(1).join('_') : key;
  }
}

/**
 * Initialize metrics object
 */
function initializeMetrics() {
  return {
    contacts: 0,
    cost: 0,
    clicks: 0,
    revenue: 0,
    messages_sent: 0,
    delivered: 0,
    failed: 0,
    opens: 0
  };
}

/**
 * Aggregate metrics from data item
 */
function aggregateMetrics(metrics, item) {
  // Only count cost for delivered messages (Telnyx only bills for delivered)
  if (item.costAmount !== undefined && item.costAmount !== null) {
    // Only add cost if message was delivered (Telnyx only bills for successfully delivered messages)
    if (item.status === 'delivered') {
      metrics.cost += parseFloat(item.costAmount) || 0;
    }
  }
  if (item.payout !== undefined && item.payout !== null) {
    metrics.revenue += parseFloat(item.payout) || 0;
  }
  if (item.clicks !== undefined && item.clicks !== null) {
    metrics.clicks += parseInt(item.clicks) || 0;
  }
  if (item.opens !== undefined && item.opens !== null) {
    metrics.opens += parseInt(item.opens) || 0;
  }
  if (item.status === 'delivered') {
    metrics.delivered += 1;
  }
  if (item.status === 'sending_failed' || item.status === 'delivery_failed') {
    metrics.failed += 1;
  }
  if (item.direction === 'outbound') {
    metrics.messages_sent += 1;
  }
  // Contact count would need to be calculated separately
}

/**
 * Calculate derived metrics (CPC, ROAS, EPC, Conversion Rate)
 */
function calculateDerivedMetrics(breakdown) {
  Object.values(breakdown).forEach(level1 => {
    calculateMetricsForNode(level1);
    
    Object.values(level1.children || {}).forEach(level2 => {
      calculateMetricsForNode(level2);
      
      Object.values(level2.children || {}).forEach(level3 => {
        calculateMetricsForNode(level3);
      });
    });
  });
}

/**
 * Calculate derived metrics for a single node
 */
function calculateMetricsForNode(node) {
  const m = node.metrics;
  
  // CPC (Cost per Click)
  m.cpc = m.clicks > 0 ? m.cost / m.clicks : 0;
  
  // ROAS (Return on Ad Spend)
  m.roas = m.cost > 0 ? m.revenue / m.cost : 0;
  
  // EPC (Earnings per Click)
  m.epc = m.clicks > 0 ? m.revenue / m.clicks : 0;
  
  // Conversion Rate - simplified: if there's revenue, there was a conversion
  // In a more sophisticated system, this would track actual conversion events
  // For now, we'll use revenue events count if available, otherwise estimate
  m.conversion_rate = m.clicks > 0 ? ((m.revenue > 0 ? 1 : 0) * 100) : 0;
}

/**
 * Flatten breakdown tree for table display
 * @param {Object} breakdown - Breakdown tree
 * @param {Array} dimensions - Dimension array
 * @returns {Array} - Flattened rows
 */
export function flattenBreakdown(breakdown, dimensions) {
  const rows = [];
  
  Object.values(breakdown).forEach(level1 => {
    const hasChildren = Object.keys(level1.children || {}).length > 0;
    
    if (!hasChildren) {
      // Leaf node - add as single row
      rows.push({
        level: 1,
        key: level1.key,
        label: level1.label,
        dimension: level1.dimension,
        metrics: level1.metrics,
        parentKey: null
      });
    } else {
      // Has children - add parent row
      rows.push({
        level: 1,
        key: level1.key,
        label: level1.label,
        dimension: level1.dimension,
        metrics: aggregateChildMetrics(level1),
        parentKey: null,
        hasChildren: true
      });
      
      // Add level 2 rows
      Object.values(level1.children).forEach(level2 => {
        const hasLevel3 = Object.keys(level2.children || {}).length > 0;
        
        if (!hasLevel3) {
          rows.push({
            level: 2,
            key: level2.key,
            label: level2.label,
            dimension: level2.dimension,
            metrics: level2.metrics,
            parentKey: level1.key
          });
        } else {
          rows.push({
            level: 2,
            key: level2.key,
            label: level2.label,
            dimension: level2.dimension,
            metrics: aggregateChildMetrics(level2),
            parentKey: level1.key,
            hasChildren: true
          });
          
          // Add level 3 rows
          Object.values(level2.children).forEach(level3 => {
            rows.push({
              level: 3,
              key: level3.key,
              label: level3.label,
              dimension: level3.dimension,
              metrics: level3.metrics,
              parentKey: level2.key
            });
          });
        }
      });
    }
  });
  
  return rows;
}

/**
 * Aggregate metrics from children
 */
function aggregateChildMetrics(node) {
  const aggregated = initializeMetrics();
  
  Object.values(node.children || {}).forEach(child => {
    aggregated.cost += child.metrics.cost;
    aggregated.revenue += child.metrics.revenue;
    aggregated.clicks += child.metrics.clicks;
    aggregated.opens += child.metrics.opens;
    aggregated.delivered += child.metrics.delivered;
    aggregated.failed += child.metrics.failed;
    aggregated.messages_sent += child.metrics.messages_sent;
  });
  
  // Recalculate derived metrics
  aggregated.cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
  aggregated.roas = aggregated.cost > 0 ? aggregated.revenue / aggregated.cost : 0;
  aggregated.epc = aggregated.clicks > 0 ? aggregated.revenue / aggregated.clicks : 0;
  aggregated.conversion_rate = aggregated.clicks > 0 ? (aggregated.revenue > 0 ? 1 : 0) * 100 : 0;
  
  return aggregated;
}

