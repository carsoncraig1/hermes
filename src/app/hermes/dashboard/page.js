import { getDashboardData } from '@/lib/actions/dashboard';
import DashboardHeader from './components/DashboardHeader';
import ConsoleWindow from '../console/components/ConsoleWindow';
import DedicatedSendCard from './components/DedicatedSendCard';
import ManualFireCard from './components/ManualFireCard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ContactStatsCards from './components/ContactStatsCards';
import SpamRateCard from './components/SpamRateCard';
import './dashboard.css';

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  // OPTIMIZED: Single server call fetches ALL dashboard data in parallel
  const dashboardData = await getDashboardData('today');

  return (
    <div className="dashboard-container">
      <DashboardHeader />
      <div className="dashboard-content">
        <div className="main-content">
          <ContactStatsCards 
            initialData={dashboardData.contactStats}
          />
          <SpamRateCard initialAnalytics={dashboardData.spamAnalytics} />
          <div className="campaign-cards-container">
            <DedicatedSendCard 
              initialCampaigns={dashboardData.dedicatedSendCampaigns}
              userTimezone={dashboardData.userTimezone}
            />
            <ManualFireCard 
              initialCampaigns={dashboardData.workflowCampaigns}
            />
          </div>
          <AnalyticsDashboard 
            initialAnalytics={dashboardData.analytics}
          />
        </div>
        <div className="side-content">
          <ConsoleWindow 
            compact={true} 
            initialLogs={dashboardData.logs}
          />
        </div>
      </div>
    </div>
  );
} 