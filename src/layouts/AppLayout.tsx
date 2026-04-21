import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import BottomTabBar from '@/components/BottomTabBar'
import Ticker from '@/components/Ticker'
import ChatBubble from '@/components/ChatBubble'
import ConnectionStatus from '@/components/ConnectionStatus'
import CacheStatusBar from '@/components/CacheStatusBar'
import VersionNotifier from '@/components/VersionNotifier'
import InactivityLock from '@/components/InactivityLock'
import UpdateBanner from '@/components/UpdateBanner'
import { ThemeProvider } from '@/components/ThemeProvider'
import GlobalLocationPing from '@/components/GlobalLocationPing'

export default function AppLayout() {
  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <ConnectionStatus />
        <CacheStatusBar />
        <Ticker />
        <UpdateBanner />
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:flex md:w-56 md:flex-shrink-0 h-full">
            <Sidebar />
          </div>
          <MobileNav />
          <main className="flex-1 overflow-y-auto overscroll-none flex flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
            <Outlet />
          </main>
        </div>
        <BottomTabBar />
        <ChatBubble />
        <VersionNotifier />
        <InactivityLock />
        <GlobalLocationPing />
      </div>
    </ThemeProvider>
  )
}
