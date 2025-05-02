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
        <a href="/hermes/dashboard" className={`nav-item ${pathname === '/hermes/dashboard' ? 'active' : ''}`}>
          <span>📊 Dashboard</span>
        </a>
        <a href="/hermes/campaigns" className={`nav-item ${pathname === '/hermes/campaigns' ? 'active' : ''}`}>
          <span>📈 Campaigns</span>
        </a>
        <a href="/hermes/numbers" className={`nav-item ${pathname === '/hermes/numbers' ? 'active' : ''}`}>
          <span>📱 Numbers</span>
        </a>
        <a href="/hermes/messages" className={`nav-item ${pathname === '/hermes/messages' ? 'active' : ''}`}>
          <span>💬 Messages</span>
        </a>
        <a href="/hermes/contacts" className={`nav-item ${pathname === '/hermes/contacts' ? 'active' : ''}`}>
          <span>👥 Contacts</span>
        </a>
        <a href="/hermes/settings" className={`nav-item ${pathname === '/hermes/settings' ? 'active' : ''}`}>
          <span>⚙️ Settings</span>
        </a>
        <a href="/hermes/console" className={`nav-item ${pathname === '/hermes/console' ? 'active' : ''}`}>
          <span>🖥️ Console</span>
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