import axios from 'axios'
import type { QueryResponse, ConnectionType } from '@/types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 120_000,   // 2 minutes — LLM calls can be slow
  headers: { 'Content-Type': 'application/json' },
})

// ── Query ────────────────────────────────────────────────

export interface RunQueryParams {
  question: string
  connection_id: string
  connection_type: ConnectionType
  host: string
  port: number
  database: string
  username: string
  password: string
  llm_provider: 'openai' | 'anthropic'
  user_api_key?: string
}

export async function runQuery(params: RunQueryParams): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>('/api/query/', params)
  return data
}

// ── Connections ───────────────────────────────────────────

export async function testConnection(params: {
  type: 'postgresql' | 'mysql'
  host: string
  port: number
  database: string
  username: string
  password: string
}): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post('/api/connections/test', params)
  return data
}

export async function createConnection(params: {
  name: string
  type: ConnectionType
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
}): Promise<{ id: string; status: string; message: string }> {
  const { data } = await api.post('/api/connections/', params)
  return data
}

export async function listConnections(): Promise<{ connections: unknown[]; total: number }> {
  const { data } = await api.get('/api/connections/')
  return data
}

export async function getConnectionStatus(id: string): Promise<{
  id: string
  status: string
  progress: number
  message: string
}> {
  const { data } = await api.get(`/api/connections/${id}/status`)
  return data
}

export async function syncConnection(id: string): Promise<void> {
  await api.post(`/api/connections/${id}/sync`)
}

export async function deleteConnection(id: string): Promise<void> {
  await api.delete(`/api/connections/${id}`)
}

// ── Health ────────────────────────────────────────────────

export async function checkHealth(): Promise<{ status: string }> {
  const { data } = await api.get('/api/health')
  return data
}

export default api