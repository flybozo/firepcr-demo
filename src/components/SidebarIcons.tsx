// Stencil-style sidebar icons — thin stroke, no fill, consistent 20×20 viewBox
// Matches the modern sidebar aesthetic of OpenClaw / Vercel / Supabase

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

// Rainbow theme — each nav icon gets its own color
export const RAINBOW_ICON_COLORS: Record<string, string> = {
  chat: '#22d3ee',         // cyan
  incidents: '#ef4444',    // red
  encounters: '#3b82f6',   // blue
  units: '#f97316',        // orange
  inventory: '#8b5cf6',    // purple
  cs: '#14b8a6',           // teal
  supply: '#eab308',       // yellow
  roster: '#22c55e',       // green
  payroll: '#ec4899',      // pink
  admin: '#6366f1',        // indigo
  documents: '#06b6d4',    // cyan
  profile: '#a855f7',      // violet
  schedule: '#f59e0b',     // amber
  logout: '#78716c',       // stone
}

export const SidebarIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'incidents':
      // Map pin with flame
      return <svg {...iconProps}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><path d="M12 6c-1.5 0-3 1.5-3 3.5 0 2.5 3 5 3 5s3-2.5 3-5C15 7.5 13.5 6 12 6z" /><path d="M12 6c.83 0 1.5.9 1.5 2 0 1.5-1.5 3-1.5 3s-1.5-1.5-1.5-3c0-1.1.67-2 1.5-2z" /></svg>
    case 'encounters':
      // Clipboard with heart
      return <svg {...iconProps}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M12 18v-6" /><path d="M9 15h6" /></svg>
    case 'units':
      // Ambulance / truck
      return <svg {...iconProps}><path d="M5 17h2m4 0h2m4 0h2" /><rect x="1" y="6" width="15" height="11" rx="2" /><path d="M16 9h4l3 4v4h-7V9z" /><circle cx="7" cy="17" r="2" /><circle cx="19" cy="17" r="2" /></svg>
    case 'inventory':
      // Package / box
      return <svg {...iconProps}><path d="M21 8l-9.5-5.5L2 8l9.5 5.5L21 8z" /><path d="M2 8v8l9.5 5.5L21 16V8" /><path d="M11.5 13.5V21" /><path d="M6.5 10.5l9.5-5.5" /></svg>
    case 'cs':
      // Shield with lock
      return <svg {...iconProps}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><rect x="10" y="11" width="4" height="4" rx="1" /><path d="M12 11V9a1 1 0 0 0-1-1h0a1 1 0 0 0-1 1v2" /></svg>
    case 'supply':
      // Shopping cart
      return <svg {...iconProps}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
    case 'roster':
      // Users / people
      return <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'payroll':
      // Dollar sign in circle
      return <svg {...iconProps}><circle cx="12" cy="12" r="10" /><path d="M16 8h-3a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
    case 'admin':
      // Sliders / settings
      return <svg {...iconProps}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
    // Footer icons
    case 'documents':
      return <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
    case 'profile':
      return <svg {...iconProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    case 'schedule':
      return <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    case 'logout':
      return <svg {...iconProps}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
    case 'bell':
      return <svg {...iconProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
    case 'chat':
      // Speech bubble with dots
      return <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="9" y1="10" x2="9" y2="10" strokeWidth={2.5} /><line x1="12" y1="10" x2="12" y2="10" strokeWidth={2.5} /><line x1="15" y1="10" x2="15" y2="10" strokeWidth={2.5} /></svg>
    case 'more':
      // Three horizontal dots
      return <svg {...iconProps}><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg>
    case 'analytics':
      // Bar chart
      return <svg {...iconProps}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    case 'financial':
      // Dollar bill / banknote
      return <svg {...iconProps}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M2 10h2" /><path d="M20 10h2" /><path d="M2 14h2" /><path d="M20 14h2" /></svg>
    case 'fire-dashboard':
      // External link / globe
      return <svg {...iconProps}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
    case 'announcements':
      // Megaphone
      return <svg {...iconProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><line x1="12" y1="2" x2="12" y2="4" /></svg>
    case 'chat-requests':
      // Chat with question mark
      return <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M12 8a1.5 1.5 0 0 1 1.5 1.5c0 .83-.67 1.5-1.5 2" /><line x1="12" y1="14" x2="12" y2="14" strokeWidth={2.5} /></svg>
    case 'company':
      // Building
      return <svg {...iconProps}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="6" x2="9" y2="6" strokeWidth={2} /><line x1="15" y1="6" x2="15" y2="6" strokeWidth={2} /><line x1="9" y1="10" x2="9" y2="10" strokeWidth={2} /><line x1="15" y1="10" x2="15" y2="10" strokeWidth={2} /><line x1="9" y1="14" x2="9" y2="14" strokeWidth={2} /><line x1="15" y1="14" x2="15" y2="14" strokeWidth={2} /><path d="M10 22v-4h4v4" /></svg>
    case 'calendar':
      // Calendar with clock
      return <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><circle cx="15" cy="16" r="2" /><path d="M15 15v1h1" /></svg>
    case 'generate':
      // Lightning bolt
      return <svg {...iconProps}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    case 'contacts':
      // Address book / phone
      return <svg {...iconProps}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
    default:
      return <svg {...iconProps}><circle cx="12" cy="12" r="10" /></svg>
  }
}
