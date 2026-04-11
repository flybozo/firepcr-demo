

import { useState } from 'react'
import Sidebar from './Sidebar'

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 z-[60] p-2.5 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl md:hidden shadow-xl"
        style={{ top: 'max(env(safe-area-inset-top, 0px) + 8px, 12px)' }}
      >
        <div className="space-y-1">
          <div className="w-5 h-0.5 bg-white" />
          <div className="w-5 h-0.5 bg-white" />
          <div className="w-5 h-0.5 bg-white" />
        </div>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform md:hidden ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onNavigate={() => setOpen(false)} />
      </div>
    </>
  )
}
