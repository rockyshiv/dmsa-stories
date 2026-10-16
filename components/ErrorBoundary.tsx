"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Safety net for unexpected screen errors: instead of a blank page, people see a short message and
 * a way out (the fallback), and the error is handed to onError for the technical log.
 */
interface Props {
  fallback: (reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      this.props.onError?.(error, info);
    } catch {
      /* reporting must never cause a second failure */
    }
    console.error("Screen error:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
