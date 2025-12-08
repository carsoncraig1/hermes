'use client';

import { useState, useEffect } from 'react';
import { getAnalytics, getCampaignDeliveryStatus } from '@/lib/actions/analytics';
import styles from './AnalyticsDashboard.module.css';

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, 90d, all

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setFullYear(2020); // All time
      }

      const [analyticsData, campaignData] = await Promise.all([
        getAnalytics({
          dateRange: {
            start: startDate,
            end: endDate
          }
        }),
        getCampaignDeliveryStatus()
      ]);

      setAnalytics(analyticsData);
      setCampaignStatus(campaignData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className={styles.error}>Failed to load analytics</div>;
  }

  return (
    <div className={styles.analyticsDashboard}>
      <div className={styles.header}>
        <h2>Message Analytics</h2>
        <select 
          value={dateRange} 
          onChange={(e) => setDateRange(e.target.value)}
          className={styles.dateRangeSelect}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Messages</div>
          <div className={styles.statValue}>{analytics.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Delivered</div>
          <div className={`${styles.statValue} ${styles.success}`}>{analytics.delivered}</div>
          <div className={styles.statSubtext}>
            {analytics.deliveryRate.toFixed(1)}% delivery rate
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Failed</div>
          <div className={`${styles.statValue} ${styles.error}`}>{analytics.failed}</div>
          <div className={styles.statSubtext}>
            {analytics.total > 0 ? ((analytics.failed / analytics.total) * 100).toFixed(1) : 0}% failure rate
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Cost</div>
          <div className={styles.statValue}>${analytics.totalCost.toFixed(2)}</div>
          <div className={styles.statSubtext}>
            {analytics.total > 0 ? `$${(analytics.totalCost / analytics.total).toFixed(4)} per message` : 'N/A'}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Campaign Performance</h3>
        <div className={styles.campaignTable}>
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Total</th>
                <th>Delivered</th>
                <th>Failed</th>
                <th>Delivery Rate</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {campaignStatus.length === 0 ? (
                <tr>
                  <td colSpan="6" className={styles.noData}>No campaign data available</td>
                </tr>
              ) : (
                campaignStatus.map(campaign => (
                  <tr key={campaign.campaignId}>
                    <td>{campaign.campaignName}</td>
                    <td>{campaign.total}</td>
                    <td className={styles.success}>{campaign.delivered}</td>
                    <td className={styles.error}>{campaign.failed}</td>
                    <td>{campaign.deliveryRate.toFixed(1)}%</td>
                    <td>${campaign.totalCost.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {analytics.byDate && analytics.byDate.length > 0 && (
        <div className={styles.section}>
          <h3>Messages Over Time</h3>
          <div className={styles.chart}>
            {analytics.byDate.map(day => (
              <div key={day.date} className={styles.chartBar}>
                <div 
                  className={styles.barSegment}
                  style={{ 
                    height: `${(day.delivered / Math.max(...analytics.byDate.map(d => d.delivered + d.sent + d.failed))) * 100}%`,
                    backgroundColor: '#10b981'
                  }}
                  title={`${day.date}: ${day.delivered} delivered`}
                />
                <div 
                  className={styles.barSegment}
                  style={{ 
                    height: `${(day.sent / Math.max(...analytics.byDate.map(d => d.delivered + d.sent + d.failed))) * 100}%`,
                    backgroundColor: '#3b82f6'
                  }}
                  title={`${day.date}: ${day.sent} sent`}
                />
                <div 
                  className={styles.barSegment}
                  style={{ 
                    height: `${(day.failed / Math.max(...analytics.byDate.map(d => d.delivered + d.sent + d.failed))) * 100}%`,
                    backgroundColor: '#ef4444'
                  }}
                  title={`${day.date}: ${day.failed} failed`}
                />
                <div className={styles.chartLabel}>
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

