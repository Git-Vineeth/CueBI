'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock, Loader2, Database } from 'lucide-react'
import { testConnection, createConnection } from '@/lib/api'
import { useConnectionsStore, useSettingsStore } from '@/lib/store'
import { cn, CONNECTOR_META } from '@/lib/utils'
import type { Connection, ConnectionType } from '@/types'

// ── Add connection form state ─────────────────────────────
interface FormState {
  name:     string
  type:     'postgresql' | 'mysql'
  host:     string
  port:     string
  database: string
  username: string
  password: string
}

const EMPTY_FORM: FormState = {
  name: '', type: 'postgresql',
  host: 'localhost', port: '5432',
  database: '', username: '', password: '',
}

// ── Status badge ──────────────────────────────────────────
function StatusBadge({ status }: { status: Connection['status'] }) {
  const map = {
    ready:   { icon: CheckCircle, cls: 'text-green-600 bg-green-50 border-green-200',  label: 'Ready' },
    syncing: { icon: Loader2,     cls: 'text-blue-600 bg-blue-50 border-blue-200',     label: 'Syncing…' },
    pending: { icon: Clock,       cls: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Pending' },
    error:   { icon: AlertCircle, cls: 'text-red-600 bg-red-50 border-red-200',        label: 'Error' },
  }
  const { icon: Icon, cls, label } = map[status]
  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', cls)}>
      <Icon size={11} className={status === 'syncing' ? 'animate-spin' : ''} />
      {label}
    </span>
  )
}

export default function ConnectionsPage() {
  const { connections, upsertConnection, removeConnection } = useConnectionsStore()
  const { setActiveConnection } = useSettingsStore()

  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)
  const [testing, setTesting]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  function handlePortDefault(type: 'postgresql' | 'mysql') {
    setForm(f => ({ ...f, type, port: type === 'postgresql' ? '5432' : '3306' }))
  }

  async function handleTest() {
    if (!form.host || !form.database || !form.username) {
      toast.error('Fill in host, database, and username first')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({
        type:     form.type,
        host:     form.host,
        port:     parseInt(form.port),
        database: form.database,
        username: form.username,
        password: form.password,
      })
      setTestResult(result)
      if (result.success) toast.success('Connection successful!')
      else toast.error('Connection failed')
    } catch {
      setTestResult({ success: false, message: 'Could not reach the API. Is the backend running?' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!form.name) { toast.error('Give this connection a name'); return }
    if (!testResult?.success) { toast.error('Test the connection first'); return }

    setSaving(true)
    try {
      const result = await createConnection({
        name:     form.name,
        type:     form.type,
        host:     form.host,
        port:     parseInt(form.port),
        database: form.database,
        username: form.username,
        password: form.password,
      })

      const newConn: Connection = {
        id:     result.id,
        name:   form.name,
        type:   form.type as ConnectionType,
        status: 'pending',
      }
      upsertConnection(newConn)

      // Save to localStorage so the chat page can use it
      localStorage.setItem('bharatbi_active_connection', JSON.stringify({
        id:       result.id,
        type:     form.type,
        host:     form.host,
        port:     parseInt(form.port),
        database: form.database,
        username: form.username,
        password: form.password,
      }))
      setActiveConnection(result.id)

      toast.success(`"${form.name}" added! Schema sync started.`)
      setShowForm(false)
      setForm(EMPTY_FORM)
      setTestResult(null)
    } catch {
      toast.error('Could not save connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Data Sources</h1>
            <p className="text-sm text-gray-500 mt-0.5">Connect your databases, sheets, or exports</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setTestResult(null) }}
            className="flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={15} />
            Add connection
          </button>
        </div>

        {/* Existing connections */}
        {connections.length === 0 && !showForm && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Database size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium mb-1">No connections yet</p>
            <p className="text-sm text-gray-400">Add your first data source to start asking questions</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {connections.map(conn => {
            const meta = CONNECTOR_META[conn.type] || { label: conn.type, color: 'bg-gray-100 text-gray-700', icon: '🔗' }
            return (
              <div key={conn.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{meta.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{conn.name}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', meta.color)}>{meta.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={conn.status} />
                  <button
                    onClick={() => { removeConnection(conn.id); toast.success('Connection removed') }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add connection form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-slide-up">
            <h2 className="font-semibold text-gray-900 mb-5">New Connection</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Connection Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Production MySQL, Sales Sheet"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-saffron-400"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Database Type</label>
                <div className="flex gap-2">
                  {(['postgresql', 'mysql'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => handlePortDefault(t)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                        form.type === t
                          ? 'border-saffron-400 bg-saffron-50 text-saffron-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {CONNECTOR_META[t].icon} {CONNECTOR_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Host + Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Host</label>
                  <input
                    value={form.host}
                    onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                    placeholder="localhost or IP"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-saffron-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                  <input
                    value={form.port}
                    onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-saffron-400 font-mono"
                  />
                </div>
              </div>

              {/* Database + Username */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Database Name</label>
                  <input
                    value={form.database}
                    onChange={e => setForm(f => ({ ...f, database: e.target.value }))}
                    placeholder="mydb"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-saffron-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                  <input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="db_user"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-saffron-400"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-saffron-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  🔒 Credentials are encrypted before storage. Your data never leaves your database.
                </p>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={cn(
                  'flex items-start gap-2 text-sm rounded-lg px-3 py-2 border',
                  testResult.success
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                )}>
                  {testResult.success ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Test connection
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !testResult?.success}
                  className="flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Save & sync schema
                </button>
                <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600 ml-auto">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Coming soon connectors */}
        <div className="mt-8">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Coming in Phase 2</p>
          <div className="grid grid-cols-2 gap-2">
            {(['google_sheets', 'tally', 'zoho_crm', 'zoho_books'] as const).map(t => {
              const meta = CONNECTOR_META[t]
              return (
                <div key={t} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 opacity-60">
                  <span>{meta.icon}</span>
                  <span className="text-sm text-gray-500">{meta.label}</span>
                  <span className="ml-auto text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Soon</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}