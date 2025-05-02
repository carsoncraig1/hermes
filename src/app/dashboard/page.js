import styles from '../page.module.css'

export default function Dashboard() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <input 
          type="search" 
          placeholder="Search..." 
          className="search-bar"
        />
      </header>
      <div className="dashboard-content">
        {/* Content will go here */}
      </div>
    </div>
  )
} 