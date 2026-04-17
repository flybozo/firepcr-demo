import { useState, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import Sidebar from './Sidebar'

// Error boundary to catch Sidebar crashes
class SidebarErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MobileNav] Sidebar crashed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full bg-gray-950 p-4 text-white">
          <p className="text-red-400 text-sm">Menu failed to load</p>
          <p className="text-xs text-gray-500 mt-2">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-4 text-xs text-blue-400">Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger hidden on mobile — bottom tab bar handles nav there */}

      {/* Overlay — closes the drawer */}
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-64 z-[80] transform transition-transform duration-200 md:hidden ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarErrorBoundary>
          <Sidebar onNavigate={() => setOpen(false)} />
        </SidebarErrorBoundary>
      </div>
    </>
  )
}
