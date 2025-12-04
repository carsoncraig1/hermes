import { Outfit } from 'next/font/google'
import './auth.css'

const outfit = Outfit({ subsets: ['latin'] })

export const metadata = {
  title: 'Hermes - Sign In',
  description: 'Sign in to Hermes',
  icons: [
    {
      rel: 'icon',
      url: '/hermes-favicon.ico',
    },
  ],
}

export default function AuthLayout({ children }) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        {children}
      </body>
    </html>
  )
}

