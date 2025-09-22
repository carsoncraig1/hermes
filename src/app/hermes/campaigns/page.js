import { getCampaigns } from '@/lib/actions/campaigns'
import CampaignsTable from './components/CampaignsTable'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function Campaigns() {
  const initialCampaigns = await getCampaigns()

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Campaigns</h1>
      </header>
      <div className="dashboard-content">
        <CampaignsTable initialCampaigns={initialCampaigns} />
      </div>
    </div>
  )
} 