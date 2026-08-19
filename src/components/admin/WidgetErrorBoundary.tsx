import React from 'react';
import { logAdminUiEvent } from '@/lib/adminTelemetry';

interface Props {
  children: React.ReactNode;
  /** Friendly name shown if this one widget fails, e.g. "Break status". */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Small safety net around a single dashboard widget.
 *
 * Without this, one misbehaving strip (rota, break status, targets) takes the
 * whole tab down and staff see "This section didn't open properly" instead of
 * their leads. Now only the affected strip disappears and the page keeps working.
 */
export class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary] ${this.props.label || 'widget'} failed:`, error, info);
    logAdminUiEvent({
      event_type: 'crash',
      label: `${this.props.label || 'Widget'}: ${String(error?.message || 'failed')}`.slice(0, 200),
      detail: { scope: 'widget', stack: (error?.stack || '').slice(0, 1200) || undefined },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {this.props.label ? `${this.props.label} isn't loading right now.` : "This panel isn't loading right now."}{' '}
          Everything else on this page still works.
        </div>
      );
    }
    return this.props.children;
  }
}
