import { getShortlinks } from '@/lib/actions/shortlinks'
import { getUserTimezone } from '@/lib/actions/user'
import ShortlinksTable from './components/ShortlinksTable'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function Shortlinks() {
  const [initialShortlinks, userTimezone] = await Promise.all([
    getShortlinks(),
    getUserTimezone()
  ]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Shortlinks</h1>
        <input 
          type="search" 
          placeholder="Search shortlinks..." 
          className="search-bar"
        />
      </header>
      <div className="dashboard-content">
        <ShortlinksTable initialShortlinks={initialShortlinks} userTimezone={userTimezone} />
      </div>
    </div>
  )
}
