import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import Ticker from '@/components/Ticker'
import ChatBubble from '@/components/ChatBubble'
import ConnectionStatus from '@/components/ConnectionStatus'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function AppLayout() {
  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <ConnectionStatus />
        <Ticker />
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:flex md:w-56 md:flex-shrink-0 h-full">
            <Sidebar />
          </div>
          <MobileNav />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        <ChatBubble />
      </div>
    </ThemeProvider>
  )
}
