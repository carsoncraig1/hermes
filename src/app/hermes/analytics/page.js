import { getAnalytics, getCampaignsWithROAS } from '@/lib/actions/analytics';
import AnalyticsDashboard from './components/AnalyticsDashboard';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function Analytics() {
  const [analytics, campaignPerformance] = await Promise.all([
    getAnalytics(),
    getCampaignsWithROAS()
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

