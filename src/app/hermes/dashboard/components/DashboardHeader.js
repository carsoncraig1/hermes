'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function DashboardHeader() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(() => {
      // This forces a hard refresh of all server components
      router.refresh();
    });
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1>Dashboard</h1>
        <button 
          onClick={refresh} 
          className="refresh-button"
          disabled={isPending}
        >
          <svg 
            className={`refresh-icon ${isPending ? 'spinning' : ''}`}
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-1.8-5.4L23 10M23 4v6h-6" />
          </svg>
        </button>
      </div>
      <input 
        type="search" 
        placeholder="Search..." 
        className="search-bar"
      />
    </header>
  );
} 