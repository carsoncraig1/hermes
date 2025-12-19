import { getSubscribedContactsCount } from '@/lib/actions/contacts';
import DashboardHeader from './components/DashboardHeader';
import ConsoleWindow from '../console/components/ConsoleWindow';
import DedicatedSendCard from './components/DedicatedSendCard';
import ManualFireCard from './components/ManualFireCard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ContactStatsCards from './components/ContactStatsCards';
import './dashboard.css';

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const subscribedCount = await getSubscribedContactsCount();

  return (
    <div className="dashboard-container">
      <DashboardHeader />
      <div className="dashboard-content">
        <div className="main-content">
          <ContactStatsCards initialSubscribedCount={subscribedCount} />
          <div className="campaign-cards-container">
            <DedicatedSendCard />
            <ManualFireCard />
          </div>
          <AnalyticsDashboard />
        </div>
        <div className="side-content">
          <ConsoleWindow compact={true} />
        </div>
      </div>
    </div>
  );
} 