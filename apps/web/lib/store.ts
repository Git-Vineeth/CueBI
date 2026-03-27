import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Connection, UserSettings, LLMProvider } from '@/types'

// ── Settings store (persisted to localStorage) ────────────

interface SettingsStore {
  settings: UserSettings
  setLLMProvider: (p: LLMProvider) => void
  setOpenAIKey:   (k: string) => void
  setAnthropicKey:(k: string) => void
  setActiveConnection: (id: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: {
        llm_provider: 'openai',
        openai_api_key: '',
        anthropic_api_key: '',
        active_connection_id: '',
      },
      setLLMProvider:       (p) => set((s) => ({ settings: { ...s.settings, llm_provider: p } })),
      setOpenAIKey:         (k) => set((s) => ({ settings: { ...s.settings, openai_api_key: k } })),
      setAnthropicKey:      (k) => set((s) => ({ settings: { ...s.settings, anthropic_api_key: k } })),
      setActiveConnection:  (id) => set((s) => ({ settings: { ...s.settings, active_connection_id: id } })),
    }),
    { name: 'bharatbi-settings' }
  )
)

// ── Chat store (session only — not persisted) ─────────────

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  addMessage:    (msg: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  clearMessages: () => void
  setLoading:    (v: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages:  [],
  isLoading: false,
  addMessage:    (msg)     => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, upd) => set((s) => ({
    messages: s.messages.map((m) => m.id === id ? { ...m, ...upd } : m),
  })),
  clearMessages: () => set({ messages: [] }),
  setLoading:    (v) => set({ isLoading: v }),
}))

// ── Connections store ─────────────────────────────────────

interface ConnectionsStore {
  connections: Connection[]
  setConnections: (cs: Connection[]) => void
  upsertConnection: (c: Connection) => void
  removeConnection: (id: string) => void
}

export const useConnectionsStore = create<ConnectionsStore>((set) => ({
  connections: [],
  setConnections:   (cs) => set({ connections: cs }),
  upsertConnection: (c)  => set((s) => {
    const existing = s.connections.find((x) => x.id === c.id)
    if (existing) {
      return { connections: s.connections.map((x) => x.id === c.id ? c : x) }
    }
    return { connections: [...s.connections, c] }
  }),
  removeConnection: (id) => set((s) => ({
    connections: s.connections.filter((c) => c.id !== id),
  })),
}))