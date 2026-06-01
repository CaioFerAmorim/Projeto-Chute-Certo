'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/apostas', label: 'Apostas',  icon: '⚽' },
  { href: '/placar',  label: 'Placar',   icon: '🏆' },
  { href: '/grupo',   label: 'Grupo',    icon: '👥' },
  { href: '/perfil',  label: 'Perfil',   icon: '👤' },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav className="sticky bottom-0 bg-white border-t border-gray-100 flex z-10">
      {TABS.map(t => {
        const active = path.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs transition-colors
              ${active ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
