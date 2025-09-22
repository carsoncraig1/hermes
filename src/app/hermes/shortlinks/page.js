import { getShortlinks } from '@/lib/actions/shortlinks'
import ShortlinksTable from './components/ShortlinksTable'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function Shortlinks() {
  const initialShortlinks = await getShortlinks()

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
        <ShortlinksTable initialShortlinks={initialShortlinks} />
      </div>
    </div>
  )
}
