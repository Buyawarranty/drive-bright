import React from 'react';
import { forceFreshReload, isStaleBuildError } from '@/utils/lazyWithRetry';

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Outer safety net for the whole customer-facing site.
 *
 * Without this, an uncaught render error anywhere in the app (checkout,
 * customer dashboard, etc.) unmounts the tree and leaves whatever static
 * markup was already sitting inside #root — including the SEO fallback
 * content the build injects into index.html for crawlers — permanently on
 * screen with no way to recover except knowing to hit refresh. That is what
 * "the site crashes" looked like for customers returning from an external
 * checkout (Bumper) to a mid-flow step: a frozen, unstyled page instead of
 * either the real app or a clear error.
 */
export class RootErrorBoundary extends React.Component<
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
    console.error('[RootErrorBoundary]', error, info);

    // Stale-chunk auto-recovery: after a fresh deploy the old JS chunks may
    // 404. Force one hard reload so the browser picks up the new bundle.
    if (isStaleBuildError(error)) {
      forceFreshReload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-white">
          <div className="max-w-lg w-full border border-gray-200 rounded-lg p-6 bg-white shadow-sm text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              This page didn't load properly. This usually sorts itself out with
              a quick refresh — any quote or payment details you'd already
              entered are saved.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              <button
                className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm font-semibold hover:bg-orange-600"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Back to homepage
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RootErrorBoundary;
