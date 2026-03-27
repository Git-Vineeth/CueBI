'use client'

import { Sparkles, Clock, Zap } from 'lucide-react'
import SQLBlock  from './SQLBlock'
import DataTable from './DataTable'
import Chart     from '@/components/charts/Chart'
import type { Message } from '@/types'
import { formatDuration } from '@/lib/utils'

interface Props {
  message: Message
  onSuggestedQuestion?: (q: string) => void
}

export default function AIMessage({ message, onSuggestedQuestion }: Props) {
  const r = message.queryResponse

  // ── Loading skeleton ──────────────────────────────────
  if (message.isLoading) {
    return (
      <div className="msg-ai animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-saffron-500 to-teal-500 flex-shrink-0" />
          <span className="text-sm text-gray-500">BharatBI is thinking…</span>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton h-24 w-full mt-3" />
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────
  if (r?.status === 'error' || message.role === 'error') {
    return (
      <div className="msg-ai border-red-100 animate-fade-in">
        <div className="flex items-start gap-2">
          <span className="text-red-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-red-700 mb-1">Could not answer that</p>
            <p className="text-sm text-gray-600">{r?.error || message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── No structured response (plain text) ──────────────
  if (!r) {
    return (
      <div className="msg-ai animate-fade-in">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
      </div>
    )
  }

  // ── Full structured response ──────────────────────────
  return (
    <div className="msg-ai animate-slide-up space-y-4">

      {/* Summary */}
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="text-saffron-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-800 leading-relaxed">{r.summary || 'Query completed.'}</p>
      </div>

      {/* Chart */}
      {r.chart && r.chart.chart_type !== 'table' && Object.keys(r.chart.echarts_option || {}).length > 0 && (
        <Chart chart={r.chart} height={260} />
      )}

      {/* Data table */}
      {r.columns?.length > 0 && r.rows?.length > 0 && (
        <DataTable columns={r.columns} rows={r.rows} />
      )}

      {/* SQL block */}
      {r.sql && <SQLBlock sql={r.sql} />}

      {/* Meta footer */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatDuration(r.duration_ms)}
          </span>
          <span className="flex items-center gap-1">
            <Zap size={10} />
            {r.llm_model}
          </span>
          <span>{r.row_count?.toLocaleString()} row{r.row_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Suggested follow-up questions */}
      {r.suggested_questions?.length > 0 && (
        <div className="pt-1 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 mb-2 font-medium">SUGGESTED FOLLOW-UPS</p>
          <div className="flex flex-wrap gap-2">
            {r.suggested_questions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSuggestedQuestion?.(q)}
                className="text-xs bg-gray-50 hover:bg-saffron-50 border border-gray-200 hover:border-saffron-300 text-gray-600 hover:text-saffron-700 rounded-full px-3 py-1 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}