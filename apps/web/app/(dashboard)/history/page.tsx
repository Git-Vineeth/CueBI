'use client'

import { useChatStore } from '@/lib/store'
import { formatDuration } from '@/lib/utils'
import { Clock, Zap, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function HistoryPage() {
  const { messages } = useChatStore()
  const router = useRouter()

  const queryMessages = messages.filter(m => m.role === 'assistant' && m.queryResponse?.status === 'success')

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Query History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your recent questions (current session)</p>
        </div>

        {queryMessages.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Clock size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No queries yet</p>
            <p className="text-sm text-gray-400 mb-4">Ask a question to see it here</p>
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center gap-2 mx-auto text-sm bg-saffron-500 text-white px-4 py-2 rounded-lg hover:bg-saffron-600 transition-colors"
            >
              Go to chat <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...queryMessages].reverse().map(msg => {
              const r = msg.queryResponse!
              return (
                <div key={msg.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-saffron-300 transition-colors">
                  <p className="text-sm font-medium text-gray-900 mb-1">{r.question}</p>
                  <p className="text-xs text-gray-500 line-clamp-1 mb-2">{r.summary}</p>
                  <div className="flex items-center gap-4 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={10} />{formatDuration(r.duration_ms)}</span>
                    <span className="flex items-center gap-1"><Zap size={10} />{r.llm_model}</span>
                    <span>{r.row_count} rows</span>
                    <span className="ml-auto">{msg.timestamp.toLocaleTimeString('en-IN')}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}