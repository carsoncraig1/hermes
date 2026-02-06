export default function CampaignsLoading() {
  const pulseStyle = { animation: 'pulse 1.5s ease-in-out infinite' };
  
  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Campaigns</h1>
        </header>
        <div className="dashboard-content">
          <div style={{ padding: '24px' }}>
            {/* Search/Filter Bar Skeleton */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginBottom: '24px',
              alignItems: 'center'
            }}>
              <div style={{
                height: '40px',
                width: '300px',
                backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                borderRadius: '8px',
                ...pulseStyle
              }} />
              <div style={{
                height: '40px',
                width: '120px',
                backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                borderRadius: '8px',
                ...pulseStyle,
                animationDelay: '0.1s'
              }} />
            </div>
            
            {/* Table Skeleton */}
            <div style={{
              backgroundColor: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                height: '48px',
                backgroundColor: 'var(--bg-tertiary, #252542)',
                borderBottom: '1px solid var(--border-color, #333)'
              }} />
              
              {/* Rows */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{
                  height: '64px',
                  borderBottom: '1px solid var(--border-color, #333)',
                  ...pulseStyle,
                  animationDelay: `${i * 0.1}s`
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
