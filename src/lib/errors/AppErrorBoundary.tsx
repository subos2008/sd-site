import { Component, type ReactNode } from 'react'
import { captureError } from './sentry'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    captureError(error)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 24, maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please reload the page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
