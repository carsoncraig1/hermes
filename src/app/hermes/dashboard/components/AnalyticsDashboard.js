'use client';

import { useState } from 'react';
import { getAnalyticsOptimized } from '@/lib/actions/dashboard';
import styles from './AnalyticsDashboard.module.css';

export default function AnalyticsDashboard({ initialAnalytics }) {
  // OPTIMIZED: Use pre-fetched data from server
  const [analytics, setAnalytics] = useState(initialAnalytics || null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [customDateRange, setCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Only fetch when user changes date range (not on initial load)
  const loadAnalytics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // Use optimized aggregate query
      const analyticsData = await getAnalyticsOptimized(dateRange);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Handle date range changes
  const handleDateRangeChange = (newRange) => {
    setDateRange(newRange);
    setCustomDateRange(false);
    loadAnalytics();
  };

  const handleRefresh = () => {
    loadAnalytics(true);
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
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className={styles.dateRangeSelect}
            >
              <option value="today">Today</option>
              <option value="3d">Last 3 days</option>
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
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className={styles.refreshButton}
            title="Refresh analytics"
          >
            <span className={styles.refreshIcon} style={{ 
              display: 'inline-block',
              transform: refreshing ? 'rotate(360deg)' : 'rotate(0deg)',
              transition: refreshing ? 'transform 0.6s linear' : 'none'
            }}>
              🔄
            </span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
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
              {formatNumber(analytics.deliveredMessages || 0)}
            </div>
            <div className={styles.statSubtext}>
              {analytics.failedMessages > 0 
                ? `${analytics.failedMessages} failed`
                : 'Messages delivered'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

