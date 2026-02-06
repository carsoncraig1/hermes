export default function ContactsLoading() {
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
          <h1>Contacts</h1>
        </header>
        <div className="dashboard-content" style={{ padding: '24px' }}>
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
              width: '150px',
              backgroundColor: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: '8px',
              ...pulseStyle,
              animationDelay: '0.1s'
            }} />
            <div style={{ flex: 1 }} />
            <div style={{
              height: '40px',
              width: '120px',
              backgroundColor: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: '8px',
              ...pulseStyle,
              animationDelay: '0.2s'
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
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} style={{
                height: '56px',
                borderBottom: '1px solid var(--border-color, #333)',
                ...pulseStyle,
                animationDelay: `${i * 0.08}s`
              }} />
            ))}
          </div>
          
          {/* Pagination Skeleton */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '24px',
            gap: '8px'
          }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: '36px',
                width: '36px',
                backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                borderRadius: '4px',
                ...pulseStyle
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
