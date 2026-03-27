'use client'

import { Database } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SchemaPage() {
  const router = useRouter()
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Schema Explorer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Browse tables, columns, and AI-generated descriptions</p>
        </div>
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Database size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Schema Explorer — Phase 1</p>
          <p className="text-sm text-gray-400 mb-4 max-w-xs mx-auto">
            Connect a data source and sync its schema. This page will show all tables and columns with their AI-generated descriptions.
          </p>
          <button
            onClick={() => router.push('/connections')}
            className="text-sm bg-saffron-500 text-white px-4 py-2 rounded-lg hover:bg-saffron-600 transition-colors"
          >
            Add a connection
          </button>
        </div>
      </div>
    </div>
  )
}