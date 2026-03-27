'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onSubmit:  (question: string) => void
  isLoading: boolean
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ onSubmit, isLoading, disabled, placeholder }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const q = value.trim()
    if (!q || isLoading || disabled) return
    onSubmit(q)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function onInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">

      {disabled && (
        <div className="mb-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ No data source connected.{' '}
          <a href="/connections" className="underline font-medium">Add a connection</a> to start asking questions.
        </div>
      )}

      <div className={cn(
        'flex items-end gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm transition-shadow',
        disabled ? 'border-gray-100 opacity-60' : 'border-gray-200 focus-within:border-saffron-400 focus-within:shadow-md'
      )}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          disabled={isLoading || disabled}
          placeholder={placeholder || 'Ask anything about your data… (⏎ to send, Shift+⏎ for new line)'}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none min-h-[24px] max-h-[160px] leading-relaxed py-0.5 disabled:cursor-not-allowed"
        />
        <button
          onClick={submit}
          disabled={!value.trim() || isLoading || disabled}
          className={cn(
            'flex-shrink-0 rounded-lg p-2 transition-colors',
            value.trim() && !isLoading && !disabled
              ? 'bg-saffron-500 hover:bg-saffron-600 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {isLoading
            ? <Loader2 size={16} className="animate-spin" />
            : <Send size={16} />
          }
        </button>
      </div>

      <p className="text-[10px] text-gray-400 text-center mt-1.5">
        BharatBI sends only schema metadata to the LLM — your data stays in your database.
      </p>
    </div>
  )
}