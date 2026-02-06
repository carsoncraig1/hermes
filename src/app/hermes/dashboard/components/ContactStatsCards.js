'use client';

import { useState, useTransition } from 'react';
import { getNetContactGrowth, getNewContactsCount, getUnsubscribedContactsCount } from '@/lib/actions/contacts';
import styles from './ContactStatsCards.module.css';

export default function ContactStatsCards({ initialData }) {
  // OPTIMIZED: Use pre-fetched data from server instead of client-side fetch
  const [subscribedCount] = useState(initialData?.subscribedCount ?? 0);
  const [netGrowth, setNetGrowth] = useState(initialData?.netGrowth ?? null);
  const [newContacts, setNewContacts] = useState(initialData?.newContactsCount ?? null);
  const [unsubscribed, setUnsubscribed] = useState(initialData?.unsubscribedCount ?? null);
  const [timeRange, setTimeRange] = useState('today');
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Only fetch on time range change (not on initial load - data comes from server)
  const loadTimeRangeStats = async (range) => {
    setLoading(true);
    try {
      const [netGrowthData, newContactsData, unsubscribedData] = await Promise.all([
        getNetContactGrowth(range),
        getNewContactsCount(range),
        getUnsubscribedContactsCount(range)
      ]);
      
      setNetGrowth(netGrowthData);
      setNewContacts(newContactsData);
      setUnsubscribed(unsubscribedData);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
    startTransition(() => {
      loadTimeRangeStats(newRange);
    });
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '...';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className={styles.statsContainer}>
      {/* Subscribed Contacts - No time range */}
      <div className={styles.statCard}>
        <h3>Subscribed Contacts</h3>
        <p className={styles.statNumber}>{formatNumber(subscribedCount)}</p>
      </div>

      {/* Net Contact Growth - With time range */}
      <div className={styles.statCard}>
        <div className={styles.statHeader}>
          <h3>Net Contact Growth</h3>
          <select 
            value={timeRange} 
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className={styles.timeRangeSelect}
            disabled={isPending || loading}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <p className={styles.statNumber}>
          {loading ? '...' : (netGrowth !== null ? (netGrowth >= 0 ? '+' : '') + formatNumber(netGrowth) : '...')}
        </p>
      </div>

      {/* New Contacts - With time range */}
      <div className={styles.statCard}>
        <div className={styles.statHeader}>
          <h3>New Contacts</h3>
          <select 
            value={timeRange} 
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className={styles.timeRangeSelect}
            disabled={isPending || loading}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <p className={styles.statNumber}>{loading ? '...' : formatNumber(newContacts)}</p>
      </div>

      {/* Unsubscribed Contacts - With time range */}
      <div className={styles.statCard}>
        <div className={styles.statHeader}>
          <h3>Unsubscribed Contacts</h3>
          <select 
            value={timeRange} 
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className={styles.timeRangeSelect}
            disabled={isPending || loading}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <p className={styles.statNumber}>{loading ? '...' : formatNumber(unsubscribed)}</p>
      </div>
    </div>
  );
}

