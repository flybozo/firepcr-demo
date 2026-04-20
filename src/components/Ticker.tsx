import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'

type TickerItem = {
  text: string
  priority: 'normal' | 'urgent'
  href?: string
}

export default function Ticker() {
  const supabase = createClient()
  const navigate = useNavigate()
  const assignment = useUserAssignment()
  const [items, setItems] = useState<TickerItem[]>([])
  const [animKey, setAnimKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (assignment.loading) return
    const fetchData = async () => {
      const fetchedItems: TickerItem[] = []

      // Unsigned orders count
      let query = supabase
        .from('dispense_admin_log')
        .select('id', { count: 'exact', head: true })
        .eq('requires_cosign', true)
        .is('provider_signature_url', null)
      const isAdmin = ['Admin', 'MD', 'DO'].includes(assignment.employee?.role || '')
      if (!isAdmin && assignment.employee?.name) {
        query = query.eq('prescribing_provider', assignment.employee.name)
      }
      const { count } = await query
      if (count && count > 0) {
        fetchedItems.push({
          text: `⚠️ ${count} unsigned order${count === 1 ? '' : 's'} — tap to review`,
          priority: 'urgent',
          href: '/unsigned-orders',
        })
      }

      // Announcements — filter by user role using audience_list
      const now = new Date().toISOString()
      const userRole = assignment.employee?.role || ''
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, message, priority, audience_list, audience')
        .eq('active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)
      const clinicianRoles = ['MD', 'DO', 'NP', 'PA', 'RN', 'Paramedic']
      const filteredAnnouncements = (announcements || []).filter((a: any) => {
        const list: string[] = a.audience_list || [a.audience || 'all']
        if (list.includes('all')) return true
        if (list.includes(userRole)) return true
        if (list.includes('admin') && ['MD', 'DO', 'Admin'].includes(userRole)) return true
        if (list.includes('providers') && clinicianRoles.includes(userRole)) return true
        if (list.includes('EMT') && userRole === 'EMT') return true
        if (list.includes('Paramedic') && userRole === 'Paramedic') return true
        if (list.includes('RN') && userRole === 'RN') return true
        if (list.includes('NP') && userRole === 'NP') return true
        if (list.includes('PA') && userRole === 'PA') return true
        if (list.includes('MD') && ['MD', 'DO'].includes(userRole)) return true
        return false
      })
      for (const a of filteredAnnouncements) {
        fetchedItems.push({
          text: `📢 ${a.message}`,
          priority: a.priority === 'urgent' ? 'urgent' : 'normal',
        })
      }

      setItems(fetchedItems)
      setAnimKey(k => k + 1)
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [assignment.loading, assignment.employee])

  if (items.length === 0) return null

  // Build a single long ticker string from all items
  const tickerText = items.map(i => i.text).join('     ·     ')
  const hasUrgent = items.some(i => i.priority === 'urgent')
  const handleClick = () => {
    const urgentItem = items.find(i => i.priority === 'urgent' && i.href)
    if (urgentItem?.href) navigate(urgentItem.href)
  }

  return (
    <div
      onClick={hasUrgent ? handleClick : undefined}
      className={`w-full h-8 flex items-center overflow-hidden border-b relative select-none ${
        hasUrgent
          ? 'bg-orange-950 border-orange-800 cursor-pointer'
          : 'bg-gray-800 border-gray-700'
      }`}
    >
      {/* CSS marquee — scrolls right to left */}
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .ticker-text {
          animation: ticker-scroll 40s linear infinite;
          white-space: nowrap;
          display: inline-block;
          padding-left: 100%;
        }
        @keyframes ticker-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .ticker-urgent {
          animation: ticker-scroll 40s linear infinite, ticker-flash 1.2s ease-in-out infinite;
        }
      `}</style>
      <span
        key={animKey}
        className={`text-xs font-medium ${
          hasUrgent ? 'ticker-urgent text-orange-300' : 'ticker-text text-gray-400'
        }`}
      >
        {tickerText}
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        {tickerText}
      </span>
    </div>
  )
}
