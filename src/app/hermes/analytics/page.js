import { getAnalytics, getCampaignsWithROAS } from '@/lib/actions/analytics';
import AnalyticsDashboard from './components/AnalyticsDashboard';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function Analytics() {
  // OPTIMIZED: Default to last 24 hours instead of 30 days for faster loading
  const endDate = new Date();
  const startDate = new Date();
  startDate.setHours(endDate.getHours() - 24);
  
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

