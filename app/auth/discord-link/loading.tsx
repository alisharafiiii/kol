export default function Loading() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'black', 
      color: 'lime', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
        <p>Loading Discord Link...</p>
      </div>
    </div>
  )
} 