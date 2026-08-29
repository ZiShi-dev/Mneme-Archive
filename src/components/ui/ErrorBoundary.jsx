import React from "react";
import { captureException } from "../../lib/monitoring/sentry.js";
import { t } from "../../i18n/runtime.js";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    captureException(error, { componentStack: info?.componentStack || "" });
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__card">
          <h1 className="error-boundary__title">{t("errors.boundaryTitle")}</h1>
          <p className="error-boundary__text">{t("errors.boundaryHint")}</p>
          <button type="button" className="error-boundary__retry" onClick={this.handleRetry}>
            {t("errors.retry")}
          </button>
        </div>
      </div>
    );
  }
}
