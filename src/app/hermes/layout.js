import { Inter } from 'next/font/google'
import Sidebar from './components/Sidebar/Sidebar'
import './globals.css'
import { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Hermes Admin',
  description: 'Hermes administration dashboard',
  icons: [
    {
      rel: 'icon',
      url: '/hermes-favicon.ico',
    },
  ],
}

export default function HermesLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Sidebar />
        {children}
      </body>
    </html>
  )
} 