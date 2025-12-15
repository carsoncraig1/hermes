'use client';

import { useState, useEffect, useMemo } from 'react';
import { getAnalytics, getCampaignsWithROAS } from '@/lib/actions/analytics';
import { getBreakdownData, getDimensionValues } from '@/lib/actions/analyticsBreakdown';
import { buildBreakdownTree, DIMENSIONS } from '@/lib/analyticsBreakdown';
import DimensionSelector from './DimensionSelector';
import BreakdownTable from './BreakdownTable';
import styles from './AnalyticsDashboard.module.css';

export default function AnalyticsDashboard({ initialAnalytics, initialCampaignPerformance }) {
  const [analytics, setAnalytics] = useState(initialAnalytics || null);
  const [campaignPerformance, setCampaignPerformance] = useState(initialCampaignPerformance || []);
  const [loading, setLoading] = useState(!initialAnalytics);
  const [breakdownData, setBreakdownData] = useState([]);
  const [dimensionValues, setDimensionValues] = useState(null);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Breakdown dimensions (3 levels)
  const [dimensions, setDimensions] = useState([
    DIMENSIONS.CAMPAIGN,
    DIMENSIONS.NONE,
    DIMENSIONS.NONE
  ]);

  // Load dimension values on mount
  useEffect(() => {
    getDimensionValues().then(setDimensionValues).catch(console.error);
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      // Ensure dates are valid
      const startDate = dateRange.start ? new Date(dateRange.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = dateRange.end ? (() => {
        const date = new Date(dateRange.end);
        date.setHours(23, 59, 59, 999);
        return date;
      })() : new Date();

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid date range:', dateRange);
        return;
      }

      const filters = {
        dateRange: {
          start: startDate,
          end: endDate
        }
      };

      const [analyticsData, campaignData, breakdownItems] = await Promise.all([
        getAnalytics(filters),
        getCampaignsWithROAS(filters),
        getBreakdownData(filters)
      ]);

      setAnalytics(analyticsData);
      setCampaignPerformance(campaignData);
      setBreakdownData(breakdownItems);
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    // Skip refresh on initial mount if we have initialAnalytics
    if (isInitialMount && initialAnalytics) {
      setIsInitialMount(false);
      return;
    }
    // Refresh when date range changes (but not on initial mount)
    if (!isInitialMount) {
      refreshData();
    }
  }, [dateRange.start, dateRange.end]);

  // Build breakdown tree from data
  const breakdown = useMemo(() => {
    if (!breakdownData || breakdownData.length === 0) return {};
    
    const activeDimensions = dimensions.filter(d => d !== DIMENSIONS.NONE);
    if (activeDimensions.length === 0) return {};
    
    return buildBreakdownTree(breakdownData, activeDimensions, {
      dateRange: {
        start: dateRange.start,
        end: dateRange.end
      }
    });
  }, [breakdownData, dimensions, dateRange]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatROAS = (roas) => {
    return `${roas.toFixed(2)}x`;
  };

  const handleDimensionChange = (newDimensions) => {
    setDimensions(newDimensions);
  };

  if (loading && !analytics) {
    return <div className={styles.loading}>Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className={styles.error}>Failed to load analytics</div>;
  }

  return (
    <div className={styles.analyticsContainer}>
      {/* Summary Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Revenue</div>
          <div className={styles.metricValue}>{formatCurrency(analytics.totalRevenue || 0)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Cost</div>
          <div className={styles.metricValue}>{formatCurrency(analytics.totalCost || 0)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>ROAS</div>
          <div className={`${styles.metricValue} ${styles.roasValue}`}>
            {formatROAS(analytics.roas || 0)}
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Revenue Events</div>
          <div className={styles.metricValue}>{formatNumber(analytics.revenueEventCount || 0)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Clicks</div>
          <div className={styles.metricValue}>{formatNumber(analytics.totalClicks || 0)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Conversion Rate</div>
          <div className={styles.metricValue}>
            {analytics.totalClicks > 0 
              ? `${((analytics.revenueEventCount || 0) / analytics.totalClicks) * 100).toFixed(2)}%`
              : '0%'}
          </div>
        </div>
      </div>

      {/* Breakdown Report Section */}
      <div className={styles.reportSection}>
        <div className={styles.reportHeader}>
          <h2>Breakdown Report</h2>
          <p className={styles.reportDescription}>
            Select up to 3 dimensions to create multi-level breakdown reports
          </p>
        </div>

        {/* Filters and Dimension Selectors */}
        <div className={styles.filtersSection}>
          <div className={styles.filterGroup}>
            <label>Date Range</label>
            <div className={styles.dateInputs}>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className={styles.dateInput}
              />
              <span>to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className={styles.dateInput}
              />
            </div>
          </div>

          <DimensionSelector
            dimensions={dimensions}
            onChange={handleDimensionChange}
            level={1}
          />

          {dimensions[0] !== DIMENSIONS.NONE && (
            <DimensionSelector
              dimensions={dimensions}
              onChange={handleDimensionChange}
              level={2}
            />
          )}

          {dimensions[0] !== DIMENSIONS.NONE && dimensions[1] !== DIMENSIONS.NONE && (
            <DimensionSelector
              dimensions={dimensions}
              onChange={handleDimensionChange}
              level={3}
            />
          )}

          <button
            onClick={refreshData}
            disabled={loading}
            className={styles.refreshButton}
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {/* Breakdown Table */}
        {dimensions[0] !== DIMENSIONS.NONE && (
          <div className={styles.breakdownTableSection}>
            <BreakdownTable breakdown={breakdown} dimensions={dimensions} />
          </div>
        )}
      </div>

      {/* Campaign Performance Table (Legacy) */}
      <div className={styles.tableSection}>
        <h2>Campaign Performance</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Contacts</th>
                <th>Cost</th>
                <th>Clicks</th>
                <th>CPC</th>
                <th>Revenue</th>
                <th>ROAS</th>
                <th>Conversion Rate</th>
                <th>EPC</th>
              </tr>
            </thead>
            <tbody>
              {campaignPerformance.length === 0 ? (
                <tr>
                  <td colSpan="9" className={styles.noData}>No campaign data available</td>
                </tr>
              ) : (
                campaignPerformance.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className={styles.campaignName}>{campaign.name}</td>
                    <td>{formatNumber(campaign.contactCount || 0)}</td>
                    <td className={styles.costCell}>{formatCurrency(campaign.cost)}</td>
                    <td>{formatNumber(campaign.clicks)}</td>
                    <td className={styles.costCell}>
                      {campaign.clicks > 0 ? formatCurrency(campaign.costPerClick) : '$0.00'}
                    </td>
                    <td className={styles.revenueCell}>{formatCurrency(campaign.revenue)}</td>
                    <td className={styles.roasCell}>
                      <span className={campaign.roas >= 1 ? styles.positive : styles.negative}>
                        {formatROAS(campaign.roas)}
                      </span>
                    </td>
                    <td>{campaign.conversionRate.toFixed(2)}%</td>
                    <td className={styles.revenueCell}>
                      {campaign.clicks > 0 ? formatCurrency(campaign.epc) : '$0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
