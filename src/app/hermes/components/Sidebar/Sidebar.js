'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleSignOut = () => {
    // Use window.location.origin to get the current domain dynamically
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    signOut({ callbackUrl: `${baseUrl}/login` })
  }

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="logo">
        {!isCollapsed ? (
          <h2>
            Hermes 
            <Image 
              src="/hermes.png" 
              alt="Hermes Logo" 
              width={28} 
              height={28}
              priority
            />
          </h2>
        ) : (
          <Image 
            src="/hermes.png" 
            alt="Hermes Logo" 
            width={32} 
            height={32}
            priority
          />
        )}
      </div>
      
      <nav className="nav-menu">
        <a href="/hermes/dashboard" className={`nav-item ${pathname === '/hermes/dashboard' ? 'active' : ''}`} title="Dashboard">
          <span>📊</span>
          <span>Dashboard</span>
        </a>
        <a href="/hermes/campaigns" className={`nav-item ${pathname === '/hermes/campaigns' ? 'active' : ''}`} title="Campaigns">
          <span>🎯</span>
          <span>Campaigns</span>
        </a>
        <a href="/hermes/shortlinks" className={`nav-item ${pathname === '/hermes/shortlinks' ? 'active' : ''}`} title="Shortlinks">
          <span>🔗</span>
          <span>Shortlinks</span>
        </a>
        <a href="/hermes/messages" className={`nav-item ${pathname === '/hermes/messages' ? 'active' : ''}`} title="Messages">
          <span>💬</span>
          <span>Messages</span>
        </a>
        <a href="/hermes/analytics" className={`nav-item ${pathname === '/hermes/analytics' ? 'active' : ''}`} title="Analytics">
          <span>📈</span>
          <span>Analytics</span>
        </a>
        <a href="/hermes/contacts" className={`nav-item ${pathname === '/hermes/contacts' ? 'active' : ''}`} title="Contacts">
          <span>👥</span>
          <span>Contacts</span>
        </a>
        <a href="/hermes/bulk-tagging" className={`nav-item ${pathname === '/hermes/bulk-tagging' ? 'active' : ''}`} title="Tagging">
          <span>🏷️</span>
          <span>Tagging</span>
        </a>
        <a href="/hermes/settings" className={`nav-item ${pathname === '/hermes/settings' ? 'active' : ''}`} title="Settings">
          <span>⚙️</span>
          <span>Settings</span>
        </a>
        <a href="/hermes/console" className={`nav-item ${pathname === '/hermes/console' ? 'active' : ''}`} title="Console">
          <span>🖥️</span>
          <span>Console</span>
        </a>
      </nav>

      {!isCollapsed && (
        <div className="user-section">
          <div className="user-info">
            <span className="user-name">{session?.user?.name || 'User'}</span>
            <span className="user-email">{session?.user?.email || ''}</span>
          </div>
          <button 
            onClick={handleSignOut}
            className="logout-button"
          >
            Sign out
          </button>
        </div>
      )}

      <button 
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '▶' : '◀'}
      </button>
    </div>
  )
}
