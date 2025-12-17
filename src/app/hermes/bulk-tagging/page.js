import BulkTagging from './components/BulkTagging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function BulkTaggingPage() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Tagging</h1>
      </header>
      <div className="dashboard-content" style={{ padding: '24px' }}>
        <BulkTagging />
      </div>
    </div>
  );
}

