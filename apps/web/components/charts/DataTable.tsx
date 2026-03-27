'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { cn, formatIndian, isNumeric } from '@/lib/utils'

interface Props {
  columns: string[]
  rows:    (string | number | null)[][]
  maxRows?: number
}

const PAGE_SIZE = 10

export default function DataTable({ columns, rows, maxRows = 1000 }: Props) {
  const [page, setPage] = useState(0)
  const visible = rows.slice(0, maxRows)
  const totalPages = Math.ceil(visible.length / PAGE_SIZE)
  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function downloadCSV() {
    const header = columns.join(',')
    const body   = visible.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const blob   = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = 'bharatbi_export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!columns.length) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">

      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-medium">
          {visible.length.toLocaleString()} row{visible.length !== 1 ? 's' : ''}
          {rows.length > maxRows && ` (showing first ${maxRows})`}
        </span>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <Download size={12} />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      isNumeric(cell) && 'text-right font-mono',
                      cell === null && 'text-gray-400 italic'
                    )}
                  >
                    {cell === null
                      ? 'null'
                      : isNumeric(cell) && String(cell).length > 3
                        ? formatIndian(Number(cell))
                        : String(cell)
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}