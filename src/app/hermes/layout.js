import { Inter } from 'next/font/google'
import { auth } from '@/lib/auth'
import Sidebar from './components/Sidebar/Sidebar'
import SessionProvider from './components/SessionProvider'
import './globals.css'

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

export default async function HermesLayout({ children }) {
  const session = await auth()

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          <Sidebar />
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
