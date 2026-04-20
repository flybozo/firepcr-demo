/**
 * ContactCards — Medical Directors + Deployed Units & Personnel
 * Shared between internal and external fire dashboards.
 * Side-by-side 2-column layout with distinct colored headers.
 * Contact icons reveal details on hover.
 */
import { useState } from 'react'

type Director = { id: string; name: string; role: string; phone: string | null; email: string | null; headshot_url: string | null }
type CrewMember = { name: string; role: string; role_on_unit: string; phone: string | null; email: string | null; headshot_url: string | null }
type DeployedUnit = { unit_name: string; crew: CrewMember[] }

// ── SVG Icons ────────────────────────────────────────────────────────────────
function PhoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}

function MessageIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function MailIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,7 12,13 2,7" />
    </svg>
  )
}

// ── Contact Action Button ────────────────────────────────────────────────────
function ContactButton({ href, icon, tooltip, color }: { href: string; icon: React.ReactNode; tooltip: string; color: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative">
      <a
        href={href}
        onClick={e => e.stopPropagation()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${color}`}
        title={tooltip}
      >
        {icon}
      </a>
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white whitespace-nowrap shadow-lg z-20 pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-gray-800 border-r border-b border-gray-700 rotate-45" />
        </div>
      )}
    </div>
  )
}

// ── Contact Icons Row ────────────────────────────────────────────────────────
export function ContactIcons({ phone, email }: { phone: string | null; email: string | null }) {
  if (!phone && !email) return null
  return (
    <div className="flex items-center gap-1.5">
      {phone && (
        <>
          <ContactButton
            href={`tel:${phone}`}
            icon={<PhoneIcon className="w-3.5 h-3.5" />}
            tooltip={phone}
            color="bg-green-900/60 text-green-400 hover:bg-green-800 hover:text-green-300"
          />
          <ContactButton
            href={`sms:${phone}`}
            icon={<MessageIcon className="w-3.5 h-3.5" />}
            tooltip={`Text ${phone}`}
            color="bg-blue-900/60 text-blue-400 hover:bg-blue-800 hover:text-blue-300"
          />
        </>
      )}
      {email && (
        <ContactButton
          href={`mailto:${email}`}
          icon={<MailIcon className="w-3.5 h-3.5" />}
          tooltip={email}
          color="bg-purple-900/60 text-purple-400 hover:bg-purple-800 hover:text-purple-300"
        />
      )}
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 'md' }: { name: string; url: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2)
  if (url) return <img src={url} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />
  return (
    <div className={`${dim} rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold ${textSize} shrink-0`}>
      {initials}
    </div>
  )
}

// ── Exported Component ───────────────────────────────────────────────────────
export function ContactCards({ medicalDirectors, deployedUnits }: {
  medicalDirectors?: Director[]
  deployedUnits?: DeployedUnit[]
}) {
  const hasMDs = (medicalDirectors?.length ?? 0) > 0
  const hasUnits = (deployedUnits?.length ?? 0) > 0
  if (!hasMDs && !hasUnits) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Medical Directors */}
      {hasMDs && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-red-900/40 bg-red-950/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">🏥 Medical Directors</h3>
          </div>
          <div className="divide-y divide-gray-800/60 p-2">
            {medicalDirectors!.map(md => (
              <div key={md.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800/40 transition-colors first:border-0">
                <Avatar name={md.name} url={md.headshot_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{md.name}</p>
                  <p className="text-xs text-gray-500">{md.role}</p>
                </div>
                <ContactIcons phone={md.phone} email={md.email} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deployed Units & Personnel */}
      {hasUnits && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-emerald-900/40 bg-emerald-950/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">🚑 Deployed Units & Personnel</h3>
          </div>
          <div className="p-3 space-y-3">
            {deployedUnits!.map(u => (
              <div key={u.unit_name}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-bold text-white">{u.unit_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300">
                    {u.crew.length} crew
                  </span>
                </div>
                {u.crew.length === 0 ? (
                  <p className="text-xs text-gray-600 px-1">No crew currently assigned</p>
                ) : (
                  <div className="space-y-1">
                    {u.crew.map((c, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-gray-800/40 rounded-lg px-3 py-2 hover:bg-gray-800/70 transition-colors">
                        <Avatar name={c.name} url={c.headshot_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-500">{c.role_on_unit || c.role}</p>
                        </div>
                        <ContactIcons phone={c.phone} email={c.email} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
