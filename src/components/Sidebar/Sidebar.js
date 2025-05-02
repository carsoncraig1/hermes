'use client'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="sidebar">
      <div className="logo">
        <h2>Hermes SMS</h2>
      </div>
      
      <nav className="nav-menu">
        <a href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
          <span>📊 Dashboard</span>
        </a>
        <a href="/campaigns" className={`nav-item ${pathname === '/campaigns' ? 'active' : ''}`}>
          <span>📈 Campaigns</span>
        </a>
        <a href="/numbers" className={`nav-item ${pathname === '/numbers' ? 'active' : ''}`}>
          <span>📱 Numbers</span>
        </a>
        <a href="/messages" className={`nav-item ${pathname === '/messages' ? 'active' : ''}`}>
          <span>💬 Messages</span>
        </a>
        <a href="/contacts" className={`nav-item ${pathname === '/contacts' ? 'active' : ''}`}>
          <span>👥 Contacts</span>
        </a>
        <a href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
          <span>⚙️ Settings</span>
        </a>
      </nav>

      <div className="user-section">
        <div className="user-info">
          <span className="user-name">Admin User</span>
          <span className="user-email">admin@txt.cx</span>
        </div>
      </div>
    </div>
  )
} 