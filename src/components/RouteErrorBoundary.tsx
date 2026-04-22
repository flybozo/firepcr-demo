import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-900 rounded-2xl p-6 border border-gray-800 text-center">
            <p className="text-3xl mb-3">⚠️</p>
            <h2 className="text-white text-lg font-bold mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  // Force reload bypassing service worker cache
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then(reg => {
                      if (reg) reg.update()
                    })
                  }
                  window.location.reload()
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Reload App
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-4">
              If this keeps happening, try: Settings → Clear cache, then reopen the app.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
