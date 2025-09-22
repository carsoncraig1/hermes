import { getNumbers } from '@/lib/actions/numbers';
import NumbersTable from './components/NumbersTable';

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function Numbers() {
  const initialNumbers = await getNumbers();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Numbers</h1>
      </header>
      <div className="dashboard-content">
        <NumbersTable initialNumbers={initialNumbers} />
      </div>
    </div>
  );
} 