import { Inter } from 'next/font/google'
import Sidebar from './components/Sidebar/Sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Hermes SMS',
  description: 'SMS Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Sidebar />
        {children}
      </body>
    </html>
  )
} 