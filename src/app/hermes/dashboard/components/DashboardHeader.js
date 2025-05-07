'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1>Dashboard</h1>
      </div>
    </header>
  )
} 