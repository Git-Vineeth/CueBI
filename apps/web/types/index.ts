// ─────────────────────────────────────────────────────────
//  BharatBI — Shared TypeScript types
// ─────────────────────────────────────────────────────────

// ── Chat / Query ──────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic'

export type ConnectionType =
  | 'postgresql'
  | 'mysql'
  | 'google_sheets'
  | 'tally'
  | 'zoho_crm'
  | 'zoho_books'

export interface ChartConfig {
  chart_type: 'line' | 'bar' | 'bar_horizontal' | 'pie' | 'scatter' | 'grouped_bar' | 'table'
  title: string
  x_axis?: string
  y_axis?: string
  echarts_option: Record<string, unknown>
}

export interface QueryResponse {
  query_id: string
  question: string
  sql: string
  columns: string[]
  rows: (string | number | null)[][]
  row_count: number
  chart: ChartConfig
  summary: string
  suggested_questions: string[]
  duration_ms: number
  llm_provider: string
  llm_model: string
  status: 'success' | 'error'
  error?: string
}

// ── Message (chat history) ────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'error'

export interface Message {
  id: string
  role: MessageRole
  content: string          // user's question OR assistant's summary
  timestamp: Date
  queryResponse?: QueryResponse   // full structured response from API
  isLoading?: boolean
}

// ── Connection ────────────────────────────────────────────

export interface Connection {
  id: string
  name: string
  type: ConnectionType
  status: 'pending' | 'syncing' | 'ready' | 'error'
  last_synced_at?: string
  error_message?: string
}

export interface ConnectionCredentials {
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
}

// ── Settings ──────────────────────────────────────────────

export interface UserSettings {
  llm_provider: LLMProvider
  openai_api_key?: string
  anthropic_api_key?: string
  active_connection_id?: string
}