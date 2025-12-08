'use client';

import { useState, useEffect } from 'react';
import { getAnalytics, getCampaignDeliveryStatus } from '@/lib/actions/analytics';
import styles from './AnalyticsDashboard.module.css';

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [customDateRange, setCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, startDate, endDate, customDateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let start, end;
      
      if (customDateRange) {
        start = new Date(startDate);
        end = new Date(endDate + 'T23:59:59');
      } else {
        end = new Date();
        start = new Date();
        
        switch (dateRange) {
          case '7d':
            start.setDate(end.getDate() - 7);
            break;
          case '30d':
            start.setDate(end.getDate() - 30);
            break;
          case '90d':
            start.setDate(end.getDate() - 90);
            break;
          case 'all':
            start.setFullYear(2020);
            break;
        }
      }

      const [analyticsData, campaignData] = await Promise.all([
        getAnalytics({
          dateRange: {
            start,
            end
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return <div className={styles.loading}>Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className={styles.error}>Failed to load analytics</div>;
  }

  const roas = analytics.totalCost > 0 ? (analytics.totalRevenue / analytics.totalCost) : 0;
  const profit = analytics.totalRevenue - analytics.totalCost;

  return (
    <div className={styles.analyticsCard}>
      <div className={styles.cardHeader}>
        <h2>Analytics Overview</h2>
        <div className={styles.dateControls}>
          {!customDateRange ? (
            <select 
              value={dateRange} 
              onChange={(e) => {
                setDateRange(e.target.value);
                setCustomDateRange(false);
              }}
              className={styles.dateRangeSelect}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          ) : (
            <div className={styles.customDateInputs}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={styles.dateInput}
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          )}
          <button
            onClick={() => setCustomDateRange(!customDateRange)}
            className={styles.customDateButton}
          >
            {customDateRange ? 'Preset' : 'Custom'}
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Total Revenue</div>
            <div className={`${styles.statValue} ${styles.revenue}`}>
              {formatCurrency(analytics.totalRevenue)}
            </div>
            <div className={styles.statSubtext}>
              {analytics.revenueEventCount} conversion{analytics.revenueEventCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>ROAS</div>
            <div className={`${styles.statValue} ${roas >= 1 ? styles.positive : styles.negative}`}>
              {roas.toFixed(2)}x
            </div>
            <div className={styles.statSubtext}>
              {roas >= 1 ? 'Profitable' : 'Below break-even'}
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>💵</div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Total Cost</div>
            <div className={styles.statValue}>
              {formatCurrency(analytics.totalCost)}
            </div>
            <div className={styles.statSubtext}>
              {analytics.totalMessages} message{analytics.totalMessages !== 1 ? 's' : ''} sent
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📈</div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Net Profit</div>
            <div className={`${styles.statValue} ${profit >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(profit)}
            </div>
            <div className={styles.statSubtext}>
              {profit >= 0 ? 'Positive' : 'Negative'} margin
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👆</div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Total Clicks</div>
            <div className={styles.statValue}>
              {formatNumber(analytics.totalClicks)}
            </div>
            <div className={styles.statSubtext}>
              {analytics.totalClicks > 0 
                ? `${((analytics.revenueEventCount / analytics.totalClicks) * 100).toFixed(2)}% conversion rate`
                : 'No clicks yet'}
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Delivered</div>
            <div className={`${styles.statValue} ${styles.success}`}>
              {formatNumber(analytics.totalMessages)}
            </div>
            <div className={styles.statSubtext}>
              Messages delivered
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

