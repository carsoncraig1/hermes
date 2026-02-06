export default function DashboardLoading() {
  const pulseStyle = {
    animation: 'pulse 1.5s ease-in-out infinite'
  };

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
          <div style={{ 
            height: '32px', 
            width: '200px', 
            backgroundColor: 'var(--bg-secondary, #1a1a2e)', 
            borderRadius: '4px',
            ...pulseStyle
          }} />
        </header>
        <div className="dashboard-content">
          <div className="main-content">
            {/* Stats Cards Skeleton */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  flex: 1,
                  height: '100px',
                  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                  borderRadius: '8px',
                  ...pulseStyle,
                  animationDelay: `${i * 0.1}s`
                }} />
              ))}
            </div>
            
            {/* Campaign Cards Skeleton */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              {[1, 2].map((i) => (
                <div key={i} style={{
                  flex: 1,
                  height: '200px',
                  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                  borderRadius: '8px',
                  ...pulseStyle,
                  animationDelay: `${i * 0.15}s`
                }} />
              ))}
            </div>
            
            {/* Analytics Skeleton */}
            <div style={{
              height: '300px',
              backgroundColor: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: '8px',
              ...pulseStyle
            }} />
          </div>
          
          <div className="side-content">
            {/* Console Skeleton */}
            <div style={{
              height: '400px',
              backgroundColor: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: '8px',
              ...pulseStyle
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
