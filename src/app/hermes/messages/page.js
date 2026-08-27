import { getMessages } from '@/lib/actions/messages';
import MessagesTable from './components/MessagesTable';

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic';

export default async function Messages() {
  // OPTIMIZED: Only load first page (50 messages) from last 24 hours.
  // Stats intentionally NOT awaited here: they scan the user's ALL-TIME
  // message history (minutes for high-volume accounts) and were blocking
  // first paint — MessagesTable fetches them after mount instead.
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

  const initialMessages = await getMessages({
    page: 0,
    pageSize: 50,
    dateRange: {
      start: twentyFourHoursAgo,
      end: new Date()
    }
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Messages</h1>
      </header>
      <div className="dashboard-content">
        <MessagesTable
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}