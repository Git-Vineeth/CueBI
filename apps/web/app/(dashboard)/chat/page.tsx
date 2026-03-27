'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Database } from 'lucide-react'
import AIMessage  from '@/components/chat/AIMessage'
import ChatInput  from '@/components/chat/ChatInput'
import { useChatStore, useSettingsStore } from '@/lib/store'
import { runQuery } from '@/lib/api'
import { nanoid } from '@/lib/utils'
import type { Message } from '@/types'

// ── Starter prompts shown on an empty screen ──────────────
const STARTERS = [
  'What are my top 10 customers by revenue this financial year?',
  'Show me month-on-month sales trend for the last 6 months',
  'Which products have the lowest stock quantity?',
  'What is the total GST collected last quarter?',
  'Show pending invoices older than 30 days',
]

export default function ChatPage() {
  const { messages, isLoading, addMessage, updateMessage, clearMessages, setLoading } = useChatStore()
  const { settings } = useSettingsStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [connectionConfig, setConnectionConfig] = useState<{
    id: string; type: 'postgresql' | 'mysql'
    host: string; port: number; database: string; username: string; password: string
  } | null>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load connection from localStorage (set by /connections page)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bharatbi_active_connection')
      if (saved) setConnectionConfig(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  async function handleQuestion(question: string) {
    if (!connectionConfig) {
      toast.error('No data source connected. Go to Connections first.')
      return
    }

    // Add user message
    const userMsg: Message = { id: nanoid(), role: 'user', content: question, timestamp: new Date() }
    addMessage(userMsg)

    // Add loading placeholder for AI
    const aiId = nanoid()
    const loadingMsg: Message = { id: aiId, role: 'assistant', content: '', timestamp: new Date(), isLoading: true }
    addMessage(loadingMsg)
    setLoading(true)

    try {
      const result = await runQuery({
        question,
        connection_id:   connectionConfig.id,
        connection_type: connectionConfig.type,
        host:            connectionConfig.host,
        port:            connectionConfig.port,
        database:        connectionConfig.database,
        username:        connectionConfig.username,
        password:        connectionConfig.password,
        llm_provider:    settings.llm_provider,
        user_api_key:    settings.llm_provider === 'openai'
          ? settings.openai_api_key
          : settings.anthropic_api_key,
      })

      updateMessage(aiId, {
        isLoading:     false,
        content:       result.summary || 'Done.',
        queryResponse: result,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      updateMessage(aiId, {
        isLoading:     false,
        role:          'error',
        content:       msg,
        queryResponse: { status: 'error', error: msg } as never,
      })
      toast.error('Query failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="font-semibold text-gray-900 text-sm">Ask BharatBI</h1>
          <p className="text-xs text-gray-400">
            {connectionConfig
              ? `Connected to ${connectionConfig.database} (${connectionConfig.type})`
              : 'No data source connected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded hover:bg-gray-100"
            >
              Clear chat
            </button>
          )}
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium">
            {settings.llm_provider === 'openai' ? '⚡ GPT-4o' : '⚡ Claude'}
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center pb-16 animate-fade-in">
            <div className="text-5xl mb-4">🇮🇳</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Ask anything about your data</h2>
            <p className="text-sm text-gray-500 mb-8 max-w-sm">
              {connectionConfig
                ? `Connected to ${connectionConfig.database}. Try one of these:`
                : 'Connect a data source to get started.'}
            </p>

            {connectionConfig ? (
              <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQuestion(q)}
                    className="text-left text-sm bg-white border border-gray-200 hover:border-saffron-400 hover:bg-saffron-50 text-gray-700 hover:text-saffron-700 rounded-xl px-4 py-3 transition-all shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <a
                href="/connections"
                className="flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <Database size={15} />
                Add a data source
              </a>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="msg-user text-sm">{msg.content}</div>
            ) : (
              <div className="w-full max-w-3xl">
                <AIMessage message={msg} onSuggestedQuestion={handleQuestion} />
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSubmit={handleQuestion}
        isLoading={isLoading}
        disabled={!connectionConfig}
        placeholder={
          connectionConfig
            ? 'Ask anything about your data… (⏎ to send)'
            : 'Connect a data source first…'
        }
      />
    </div>
  )
}