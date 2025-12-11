'use client';

import { useMemo } from 'react';
import { flattenBreakdown } from '@/lib/analyticsBreakdown';
import styles from './BreakdownTable.module.css';

export default function BreakdownTable({ breakdown, dimensions }) {
  const rows = useMemo(() => {
    if (!breakdown || Object.keys(breakdown).length === 0) return [];
    return flattenBreakdown(breakdown, dimensions);
  }, [breakdown, dimensions]);

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

  const formatROAS = (roas) => {
    return `${roas.toFixed(2)}x`;
  };

  const formatPercent = (num) => {
    return `${num.toFixed(2)}%`;
  };

  if (rows.length === 0) {
    return (
      <div className={styles.noData}>
        <p>No data available for the selected dimensions and date range.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.dimensionColumn}>Dimension</th>
            <th className={styles.metricColumn}>Contacts</th>
            <th className={styles.metricColumn}>Cost</th>
            <th className={styles.metricColumn}>Clicks</th>
            <th className={styles.metricColumn}>CPC</th>
            <th className={styles.metricColumn}>Revenue</th>
            <th className={styles.metricColumn}>ROAS</th>
            <th className={styles.metricColumn}>Conv. Rate</th>
            <th className={styles.metricColumn}>EPC</th>
            <th className={styles.metricColumn}>Messages</th>
            <th className={styles.metricColumn}>Delivered</th>
            <th className={styles.metricColumn}>Failed</th>
            <th className={styles.metricColumn}>Opens</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.key}-${row.parentKey}-${index}`}
              className={`${styles.tableRow} ${styles[`level${row.level}`]}`}
            >
              <td className={styles.dimensionCell}>
                <div className={styles.dimensionLabel} style={{ paddingLeft: `${(row.level - 1) * 1.5}rem` }}>
                  {row.level > 1 && <span className={styles.indent}>└─</span>}
                  {row.label}
                </div>
              </td>
              <td className={styles.metricCell}>{formatNumber(row.metrics.contacts || 0)}</td>
              <td className={styles.metricCell}>{formatCurrency(row.metrics.cost || 0)}</td>
              <td className={styles.metricCell}>{formatNumber(row.metrics.clicks || 0)}</td>
              <td className={styles.metricCell}>{formatCurrency(row.metrics.cpc || 0)}</td>
              <td className={`${styles.metricCell} ${styles.revenueCell}`}>
                {formatCurrency(row.metrics.revenue || 0)}
              </td>
              <td className={`${styles.metricCell} ${styles.roasCell}`}>
                <span className={row.metrics.roas >= 1 ? styles.positive : styles.negative}>
                  {formatROAS(row.metrics.roas || 0)}
                </span>
              </td>
              <td className={styles.metricCell}>{formatPercent(row.metrics.conversion_rate || 0)}</td>
              <td className={`${styles.metricCell} ${styles.revenueCell}`}>
                {formatCurrency(row.metrics.epc || 0)}
              </td>
              <td className={styles.metricCell}>{formatNumber(row.metrics.messages_sent || 0)}</td>
              <td className={styles.metricCell}>{formatNumber(row.metrics.delivered || 0)}</td>
              <td className={styles.metricCell}>{formatNumber(row.metrics.failed || 0)}</td>
              <td className={styles.metricCell}>{formatNumber(row.metrics.opens || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

