

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/registerSW'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker()
  }, [])
  return null
}
