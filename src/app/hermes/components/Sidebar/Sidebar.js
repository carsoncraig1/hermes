'use client'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const handleSignOut = () => {
    // Use window.location.origin to get the current domain dynamically
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    signOut({ callbackUrl: `${baseUrl}/login` })
  }

  return (
    <div className="sidebar">
      <div className="logo">
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
      </div>
      
      <nav className="nav-menu">
        <a href="/hermes/dashboard" className={`nav-item ${pathname === '/hermes/dashboard' ? 'active' : ''}`}>
          <span>📊 Dashboard</span>
        </a>
        <a href="/hermes/campaigns" className={`nav-item ${pathname === '/hermes/campaigns' ? 'active' : ''}`}>
          <span>📈 Campaigns</span>
        </a>
        <a href="/hermes/shortlinks" className={`nav-item ${pathname === '/hermes/shortlinks' ? 'active' : ''}`}>
          <span>🔗 Shortlinks</span>
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
    </div>
  )
}
