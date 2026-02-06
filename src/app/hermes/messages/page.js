import { getMessages, getMessageStats } from '@/lib/actions/messages';
import MessagesTable from './components/MessagesTable';

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic';

export default async function Messages() {
  // OPTIMIZED: Only load first page (50 messages) from last 24 hours
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
  
  const [initialMessages, initialStats] = await Promise.all([
    getMessages({ 
      page: 0, 
      pageSize: 50,
      dateRange: {
        start: twentyFourHoursAgo,
        end: new Date()
      }
    }),
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