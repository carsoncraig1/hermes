import ContactsTable from './components/ContactsTable';

export default function Contacts() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Contacts</h1>
      </header>
      <div className="dashboard-content">
        <ContactsTable />
      </div>
    </div>
  );
} 