import { getContacts } from '@/lib/actions/contacts'
import ContactsTable from './components/ContactsTable'

export default async function Contacts() {
  try {
    const contacts = await getContacts()
    
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Contacts</h1>
        </header>
        <div className="dashboard-content" style={{ padding: '24px' }}>
          <ContactsTable initialContacts={contacts} />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in Contacts page:', error)
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Contacts</h1>
        </header>
        <div className="dashboard-content" style={{ padding: '24px' }}>
          <div className="error-message">
            Error loading contacts. Please try again later.
          </div>
        </div>
      </div>
    )
  }
} 