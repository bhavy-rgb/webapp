import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time crashes anywhere in the tree and shows a styled
 * fallback instead of a blank white screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Chessify crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grain flex min-h-screen flex-col items-center justify-center gap-5 bg-cream px-5 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest text-4xl text-cream shadow-md">
            ♞
          </span>
          <h1 className="font-display text-4xl font-semibold text-ink">
            Something went wrong
          </h1>
          <p className="max-w-sm text-sm text-ink-soft">
            An unexpected error stopped the board. Refresh the page to pick up
            where you left off.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-forest px-7 py-3 text-sm font-semibold text-cream shadow-md transition-all hover:bg-forest-deep active:scale-[0.98]"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
