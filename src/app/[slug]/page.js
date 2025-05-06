const NotFoundPage = () => (
  <div style={{
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
    margin: 0,
    padding: 0
  }}>
    <div style={{ textAlign: 'center' }}>
      <h1 style={{
        color: '#FF6B00',
        fontSize: '4rem',
        fontWeight: 'bold',
        marginBottom: '1rem'
      }}>
        TXT.CX
      </h1>
      <div style={{ color: '#FF6B00' }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem'
        }}>
          404
        </h2>
        <p style={{ fontSize: '1.25rem' }}>
          Link not found
        </p>
      </div>
    </div>
  </div>
)

export default NotFoundPage
