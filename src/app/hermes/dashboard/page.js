import { getSubscribedContactsCount } from '@/lib/actions/contacts';
import DashboardHeader from './components/DashboardHeader';
import './dashboard.css';

export default async function Dashboard() {
  const subscribedCount = await getSubscribedContactsCount();

  return (
    <div className="dashboard-container">
      <DashboardHeader />
      <div className="dashboard-content">
        <div className="stats-container">
          <div className="stat-card">
            <h3>Subscribed Contacts:</h3>
            <p className="stat-number">{subscribedCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 