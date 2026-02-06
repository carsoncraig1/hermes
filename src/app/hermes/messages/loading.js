export default function MessagesLoading() {
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
          <h1>Messages</h1>
        </header>
        <div className="dashboard-content">
          <div style={{ padding: '24px' }}>
            {/* Stats Cards Skeleton */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  flex: 1,
                  height: '80px',
                  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                  borderRadius: '8px',
                  ...pulseStyle,
                  animationDelay: `${i * 0.1}s`
                }} />
              ))}
            </div>
            
            {/* Filters Skeleton */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginBottom: '24px',
              alignItems: 'center'
            }}>
              <div style={{
                height: '40px',
                width: '250px',
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
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} style={{
                  height: '52px',
                  borderBottom: '1px solid var(--border-color, #333)',
                  ...pulseStyle,
                  animationDelay: `${i * 0.05}s`
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
