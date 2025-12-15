import { getAnalytics, getCampaignsWithROAS } from '@/lib/actions/analytics';
import AnalyticsDashboard from './components/AnalyticsDashboard';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function Analytics() {
  // Use the same default date range as the client (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);
  
  const filters = {
    dateRange: {
      start: startDate,
      end: endDate
    }
  };

  const [analytics, campaignPerformance] = await Promise.all([
    getAnalytics(filters),
    getCampaignsWithROAS(filters)
  ]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Analytics</h1>
      </header>
      <div className="dashboard-content">
        <AnalyticsDashboard 
          initialAnalytics={analytics}
          initialCampaignPerformance={campaignPerformance}
        />
      </div>
    </div>
  );
}

