'use client';

import { 
  useReactTable, getCoreRowModel, flexRender, getPaginationRowModel 
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: any[];
  data: TData[];
  pageCount?: number;
  onPaginationChange?: (updater: any) => void;
  pageIndex?: number;
  pageSize?: number;
  isLoading?: boolean;
}

export function DataTable<TData, TValue>({
  columns, data, pageCount, onPaginationChange, pageIndex = 0, pageSize = 20, isLoading
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    pageCount: pageCount ?? -1,
    state: { pagination: { pageIndex, pageSize } },
    onPaginationChange,
    manualPagination: true,
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b dark:border-white/10 border-black/10 bg-black/20">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="text-left text-slate-600 dark:text-slate-600 dark:text-dark-700 font-medium px-6 py-4 whitespace-nowrap">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b dark:border-white/5 border-black/5">
                  {columns.map((c, j) => (
                    <td key={j} className="px-6 py-4"><div className="skeleton h-6 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b dark:border-white/5 border-black/5 hover:dark:bg-white/5 hover:bg-black/5 transition-colors group">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 text-dark-600 group-hover:dark:text-white hover:text-gray-900 transition-colors whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-slate-600 dark:text-slate-600 dark:text-dark-700">
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {pageCount && pageCount > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t dark:border-white/5 border-black/5 bg-black/10">
          <span className="text-sm text-slate-600 dark:text-slate-600 dark:text-dark-700">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg dark:bg-white/5 bg-black/5 dark:text-white text-gray-900 hover:dark:bg-white/10 hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg dark:bg-white/5 bg-black/5 dark:text-white text-gray-900 hover:dark:bg-white/10 hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
