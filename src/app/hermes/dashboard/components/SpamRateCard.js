'use client';

import { useState, useTransition } from 'react';
import { getSpamRateAnalytics } from '@/lib/actions/spamTracking';
import styles from './SpamRateCard.module.css';

function formatRate(rate) {
  return `${Number(rate || 0).toFixed(2)}%`;
}

export default function SpamRateCard({ initialAnalytics }) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [timeRange, setTimeRange] = useState('today');
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onRangeChange = (nextRange) => {
    setTimeRange(nextRange);
    startTransition(async () => {
      try {
        const nextAnalytics = await getSpamRateAnalytics(nextRange, 20);
        setAnalytics(nextAnalytics);
      } catch (error) {
        console.error('Error loading spam analytics:', error);
      }
    });
  };

  const summary = analytics?.summary || { spamCount: 0, outboundCount: 0, spamRate: 0 };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Spam Filter Rate (40002)</h3>
          <select
            className={styles.rangeSelect}
            value={timeRange}
            onChange={(e) => onRangeChange(e.target.value)}
            disabled={isPending}
          >
            <option value="today">Today</option>
            <option value="3d">Last 3 days</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Spam Hits</div>
            <div className={styles.metricValue}>{summary.spamCount || 0}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Outbound</div>
            <div className={styles.metricValue}>{summary.outboundCount || 0}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Spam Rate</div>
            <div className={styles.metricValue}>{formatRate(summary.spamRate)}</div>
          </div>
        </div>

        <button className={styles.detailsButton} onClick={() => setShowModal(true)}>
          View Details
        </button>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Spam Filter Analytics</h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <section className={styles.section}>
                <h4>By Campaign</h4>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Spam</th>
                        <th>Outbound</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.byCampaign || []).map((row) => (
                        <tr key={`${row.campaignId || 'none'}-${row.campaignName}`}>
                          <td>{row.campaignName}</td>
                          <td>{row.spamCount}</td>
                          <td>{row.outboundCount}</td>
                          <td>{formatRate(row.spamRate)}</td>
                        </tr>
                      ))}
                      {(analytics?.byCampaign || []).length === 0 && (
                        <tr><td colSpan={4}>No spam events in this range</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.section}>
                <h4>By Sender Number</h4>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>From Number</th>
                        <th>Spam</th>
                        <th>Outbound</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.bySender || []).map((row) => (
                        <tr key={row.senderNumber}>
                          <td>{row.senderNumber}</td>
                          <td>{row.spamCount}</td>
                          <td>{row.outboundCount}</td>
                          <td>{formatRate(row.spamRate)}</td>
                        </tr>
                      ))}
                      {(analytics?.bySender || []).length === 0 && (
                        <tr><td colSpan={4}>No spam events in this range</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.section}>
                <h4>By Day</h4>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Spam</th>
                        <th>Outbound</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.byDay || []).map((row) => (
                        <tr key={row.day}>
                          <td>{row.day}</td>
                          <td>{row.spamCount}</td>
                          <td>{row.outboundCount}</td>
                          <td>{formatRate(row.spamRate)}</td>
                        </tr>
                      ))}
                      {(analytics?.byDay || []).length === 0 && (
                        <tr><td colSpan={4}>No spam events in this range</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
