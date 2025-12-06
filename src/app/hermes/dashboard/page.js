import { getSubscribedContactsCount } from '@/lib/actions/contacts';
import DashboardHeader from './components/DashboardHeader';
import ConsoleWindow from '../console/components/ConsoleWindow';
import DedicatedSendCard from './components/DedicatedSendCard';
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
          <div className="stats-container">
            <div className="stat-card">
              <h3>Subscribed Contacts:</h3>
              <p className="stat-number">{subscribedCount}</p>
            </div>
          </div>
          <DedicatedSendCard />
        </div>
        <div className="side-content">
          <ConsoleWindow compact={true} />
        </div>
      </div>
    </div>
  );
} 