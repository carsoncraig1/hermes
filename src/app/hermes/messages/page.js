export default function Messages() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Messages</h1>
        <input 
          type="search" 
          placeholder="Search messages..." 
          className="search-bar"
        />
      </header>
      <div className="dashboard-content">
        {/* Messages content will go here */}
      </div>
    </div>
  )
} 