import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Shown in the log so a broken slot entry or panel can be traced to its module. */
  name: string
  fallback?: ReactNode
  onError?: (name: string, error: unknown, info: ErrorInfo) => void
  children?: ReactNode
}

/** Isolates one registered component: its crash renders `fallback` instead of taking the shell down. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (this.props.onError) this.props.onError(this.props.name, error, info)
    else console.error(`[pragma] ${this.props.name} crashed`, error)
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
