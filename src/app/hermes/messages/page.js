import { getMessages, getMessageStats } from '@/lib/actions/messages';
import MessagesTable from './components/MessagesTable';

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic';

export default async function Messages() {
  const [initialMessages, initialStats] = await Promise.all([
    getMessages(),
    getMessageStats()
  ]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Messages</h1>
      </header>
      <div className="dashboard-content">
        <MessagesTable 
          initialMessages={initialMessages} 
          initialStats={initialStats}
        />
      </div>
    </div>
  );
} 