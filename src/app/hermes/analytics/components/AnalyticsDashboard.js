'use client';

import { useState, useEffect } from 'react';
import { getAnalytics, getCampaignsWithROAS } from '@/lib/actions/analytics';
import styles from './AnalyticsDashboard.module.css';

export default function AnalyticsDashboard({ initialAnalytics, initialCampaignPerformance }) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [campaignPerformance, setCampaignPerformance] = useState(initialCampaignPerformance);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedShortlink, setSelectedShortlink] = useState('all');
  const [groupBy, setGroupBy] = useState('none');

  const refreshData = async () => {
    setLoading(true);
    try {
      const filters = {
        dateRange: {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end + 'T23:59:59')
        },
        ...(selectedCampaign !== 'all' && { campaignId: selectedCampaign }),
        ...(selectedShortlink !== 'all' && { shortlinkId: selectedShortlink }),
        ...(groupBy !== 'none' && { groupBy })
      };

      const [analyticsData, campaignData] = await Promise.all([
        getAnalytics(filters),
        getCampaignsWithROAS(filters)
      ]);

      setAnalytics(analyticsData);
      setCampaignPerformance(campaignData);
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [dateRange.start, dateRange.end, selectedCampaign, selectedShortlink, groupBy]);

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

  return (
    <div className={styles.analyticsContainer}>
      {/* Filters */}
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

        <div className={styles.filterGroup}>
          <label>Group By</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="none">None</option>
            <option value="campaign">Campaign</option>
            <option value="shortlink">Shortlink</option>
            <option value="date">Date</option>
          </select>
        </div>

        <button
          onClick={refreshData}
          disabled={loading}
          className={styles.refreshButton}
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Key Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Revenue</div>
          <div className={styles.metricValue}>{formatCurrency(analytics.totalRevenue)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Cost</div>
          <div className={styles.metricValue}>{formatCurrency(analytics.totalCost)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>ROAS</div>
          <div className={`${styles.metricValue} ${styles.roasValue}`}>
            {formatROAS(analytics.roas)}
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Revenue Events</div>
          <div className={styles.metricValue}>{formatNumber(analytics.revenueEventCount)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Clicks</div>
          <div className={styles.metricValue}>{formatNumber(analytics.totalClicks)}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Conversion Rate</div>
          <div className={styles.metricValue}>
            {analytics.totalClicks > 0 
              ? `${((analytics.revenueEventCount / analytics.totalClicks) * 100).toFixed(2)}%`
              : '0%'}
          </div>
        </div>
      </div>

      {/* Grouped Data Visualization */}
      {groupBy !== 'none' && Object.keys(analytics.groupedData).length > 0 && (
        <div className={styles.chartSection}>
          <h2>Revenue by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</h2>
          <div className={styles.chartContainer}>
            {Object.entries(analytics.groupedData).map(([key, data]) => (
              <div key={key} className={styles.chartBar}>
                <div className={styles.chartBarLabel}>
                  {data.name || data.date || key}
                </div>
                <div className={styles.chartBarTrack}>
                  <div
                    className={styles.chartBarFill}
                    style={{
                      width: `${(data.revenue / analytics.totalRevenue) * 100}%`
                    }}
                  />
                </div>
                <div className={styles.chartBarValue}>
                  {formatCurrency(data.revenue)} ({data.events} events)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Performance Table */}
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

      {/* Recent Revenue Events */}
      <div className={styles.tableSection}>
        <h2>Recent Revenue Events</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Campaign</th>
                <th>Shortlink</th>
                <th>Payout</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              {analytics.revenueEvents.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.noData}>No revenue events found</td>
                </tr>
              ) : (
                analytics.revenueEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                    <td>{event.campaign?.name || '—'}</td>
                    <td>{event.shortlink?.nickname || event.shortlink?.slug || '—'}</td>
                    <td className={styles.revenueCell}>{formatCurrency(parseFloat(event.payout))}</td>
                    <td>{event.currency}</td>
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

