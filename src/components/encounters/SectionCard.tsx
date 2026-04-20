import React from 'react'

export function SectionCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-3 min-w-0 overflow-hidden h-full">
      <div className="flex items-center justify-between pr-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
        {badge && <span>{badge}</span>}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {children}
      </dl>
    </div>
  )
}
