import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Accessibility Auditor] Uncaught UI error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 rounded-xl border border-red-200 bg-red-50 text-red-900 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon size={20} className="text-red-600 shrink-0" />
            <h2 className="font-bold text-sm">
              {this.props.fallbackTitle || 'Something went wrong in the auditor UI'}
            </h2>
          </div>
          <p className="text-xs text-red-700 leading-relaxed">
            An unexpected error occurred while rendering this panel. Your stored audit data is safe in IndexedDB.
          </p>
          {this.state.error?.message && (
            <pre className="p-2 rounded bg-red-100 text-[11px] font-mono text-red-950 overflow-x-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold text-xs shadow hover:bg-red-700 transition"
          >
            <RotateCcw size={13} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
