'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare, Database, History, Settings,
  GitBranch, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/chat',        label: 'Ask BharatBI',   icon: MessageSquare },
  { href: '/connections', label: 'Connections',     icon: Database },
  { href: '/history',     label: 'Query History',   icon: History },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🇮🇳</span>
          <div>
            <p className="font-bold text-navy-800 text-base leading-tight">BharatBI</p>
            <p className="text-[10px] text-gray-400 leading-tight">Ask your data anything</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'nav-link',
              path.startsWith(href) && 'active'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <a
          href="https://github.com/VineethVadlapalli/bharatbi"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link text-xs"
        >
          <GitBranch size={14} />
          GitHub — Star ⭐
        </a>
        <Link href="/settings" className="nav-link text-xs">
          <Settings size={14} />
          Settings
        </Link>
        <p className="text-[10px] text-gray-400 px-3 pt-2">
          Open source · MIT License
        </p>
      </div>
    </aside>
  )
}