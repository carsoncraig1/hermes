import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
  // Next.js requires a return statement even though redirect will handle the navigation
  return null
} 