"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV === "production") {
      // Sentry is initialized in next.config.ts; errors auto-reported via @sentry/nextjs
      console.error("[ErrorBoundary]", error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground max-w-sm">{this.state.errorMessage}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
