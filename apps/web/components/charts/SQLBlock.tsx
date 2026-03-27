'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface Props { sql: string }

export default function SQLBlock({ sql }: Props) {
  const [open,    setOpen]   = useState(false)
  const [copied,  setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden text-sm">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-1.5 text-gray-600 font-medium text-xs">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Generated SQL
        </span>
        <span className="text-[10px] text-gray-400 font-mono">
          {sql.split('\n').length} line{sql.split('\n').length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* SQL code */}
      {open && (
        <div className="relative">
          <pre className="sql-block rounded-none text-xs leading-relaxed overflow-x-auto px-4 py-3 m-0">
            {sql}
          </pre>
          <button
            onClick={copy}
            className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}
    </div>
  )
}