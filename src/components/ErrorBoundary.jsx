import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="max-w-md w-full rounded-3xl border border-rose-500/40 bg-slate-900/90 backdrop-blur-xl p-8 text-center shadow-2xl space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="font-bebas text-3xl tracking-wider text-slate-100">
              ARENA CONNECTION ISSUE
            </h2>
            <p className="text-xs font-rajdhani text-slate-400">
              The application encountered a transient network/rendering issue. Reconnecting to Convex sync...
            </p>
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-3 text-xs font-rajdhani font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload Arena</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
