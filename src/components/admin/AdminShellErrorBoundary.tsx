import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Outer safety net for the entire admin dashboard shell. If the sidebar,
 * header, or top-level layout throws, staff still see a usable page with
 * links to recover instead of a blank white screen. Per-tab errors are
 * handled by the inner TabErrorBoundary in AdminDashboard.tsx.
 */
export class AdminShellErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AdminShellErrorBoundary]', error, info);

    // Stale-chunk auto-recovery: after a fresh deploy the old JS chunks may
    // 404. Force one hard reload so the browser picks up the new bundle.
    const msg = String(error?.message || '');
    const isChunkError =
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        msg,
      );
    if (isChunkError) {
      try {
        const flag = 'baw_admin_chunk_reload_at';
        const last = Number(sessionStorage.getItem(flag) || '0');
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(flag, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* noop */
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-lg w-full border rounded-lg p-6 bg-card shadow-sm">
            <h1 className="text-xl font-semibold text-destructive">
              Something went wrong loading the admin area
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              The page didn't open properly. This normally sorts itself out with
              a quick refresh — it usually happens right after we've pushed an
              update, or if your internet dropped for a second. Any work you've
              already saved is safe.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Try the buttons below. If it still won't load, let the team know.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <button
                className="px-4 py-2 border rounded-md text-sm hover:bg-accent"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
              >
                Try again
              </button>
              <a
                href="/admin-dashboard/?tab=customers"
                className="px-4 py-2 border rounded-md text-sm hover:bg-accent"
              >
                Go to Customers
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AdminShellErrorBoundary;
