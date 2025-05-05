'use client';

import { useEffect, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';

const columnHelper = createColumnHelper();

// Filter component for the Subscribed column
function SubscribedFilter({ column }) {
  return (
    <select
      className="filter-dropdown"
      value={column.getFilterValue() ?? ''}
      onChange={e => column.setFilterValue(e.target.value)}
    >
      <option value="">All</option>
      <option value="Yes">Subscribed</option>
      <option value="No">Unsubscribed</option>
    </select>
  );
}

const columns = [
  columnHelper.accessor('timestamp', {
    header: 'Timestamp',
    cell: info => format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm'),
  }),
  columnHelper.accessor('firstName', {
    header: 'First Name',
  }),
  columnHelper.accessor('lastName', {
    header: 'Last Name',
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
  }),
  columnHelper.accessor('clickId', {
    header: 'Click ID',
  }),
  columnHelper.accessor('subscribed', {
    header: 'Subscribed',
    filterFn: 'equals',
    // Custom header that includes the filter
    header: ({ column }) => (
      <div className="filter-header">
        <span>Subscribed</span>
        <SubscribedFilter column={column} />
      </div>
    ),
  }),
];

export default function ContactsTable() {
  const [data, setData] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState([]);

  useEffect(() => {
    const fetchContacts = async () => {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      setData(data);
    };
    fetchContacts();
  }, []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
  });

  return (
    <div className="contacts-table-container">
      <input
        type="text"
        value={globalFilter}
        onChange={e => setGlobalFilter(e.target.value)}
        placeholder="Search all columns..."
        className="search-input"
      />
      <table className="contacts-table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th 
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={header.column.getCanSort() ? 'sortable' : ''}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {header.column.getCanSort() && !header.column.getFilterValue() && (
                    {
                      asc: ' 🔼',
                      desc: ' 🔽',
                    }[header.column.getIsSorted()] ?? null
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 