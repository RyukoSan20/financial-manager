/**
 * ErrorBoundary - React Error Boundary for catching component errors.
 * Reports errors to backend for centralized monitoring.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Report to backend
    await this.reportError(error, errorInfo);
    
    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // Get API URL from environment
      const API_URL = import.meta.env.VITE_API_URL || '';
      // VITE_API_URL already ends with /api, and the error router is
      // mounted at /api/errors. Writing /api/errors/client onto it
      // gave /api/api/errors/client, which the server never answers.
      const errorsUrl = `${API_URL.replace(/\/api$/, '')}/api/errors/client`;
      
      // Extract component stack
      const componentStack = errorInfo.componentStack || '';
      
      // Build error report
      const errorReport = {
        error_id: this.state.errorId,
        error_type: error.name,
        error_message: error.message,
        stack: error.stack,
        component_stack: componentStack,
        url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        // Additional context
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        // User info (if authenticated)
        user_id: this.getUserId(),
        session_id: this.getSessionId()
      };

      // Send to backend
      const response = await fetch(errorsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include auth token if available
          ...(this.getAuthToken() && {
            'Authorization': `Bearer ${this.getAuthToken()}`
          })
        },
        body: JSON.stringify(errorReport)
      });

      if (!response.ok) {
        console.warn('[ErrorBoundary] Failed to report error to backend');
      } else {
        console.log('[ErrorBoundary] Error reported successfully:', this.state.errorId);
      }
    } catch (e) {
      // Don't let reporting errors affect the app
      console.error('[ErrorBoundary] Error reporting failed:', e);
    }
  }

  getUserId(): string | null {
    try {
      const token = this.getAuthToken();
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub || payload.user_id || payload.id || null;
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  }

  getAuthToken(): string | null {
    try {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    } catch (e) {
      return null;
    }
  }

  getSessionId(): string {
    try {
      let sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('session_id', sessionId);
      }
      return sessionId;
    } catch (e) {
      return 'unknown';
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#f9fafb',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            {/* Error Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.5rem',
              background: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Terjadi Kesalahan
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              Maaf, terjadi kesalahan yang tidak terduga. Tim kami sudah diberitahu dan sedang memperbaikinya.
            </p>

            {/* Error ID */}
            {this.state.errorId && (
              <div style={{
                background: '#f3f4f6',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  margin: 0
                }}>
                  ID Error: <code style={{ color: '#374151' }}>{this.state.errorId}</code>
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.resetError}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
              >
                Coba Lagi
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                Kembali ke Beranda
              </button>
            </div>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details style={{
                marginTop: '1.5rem',
                textAlign: 'left'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  Detail Error (Development Only)
                </summary>
                <pre style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: '200px',
                  textAlign: 'left'
                }}>
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * Hook for using error boundary programmatically
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
    throw error; // Re-throw to trigger ErrorBoundary
  }, []);

  if (error) {
    throw error;
  }

  return { handleError, resetError };
}

/**
 * Page-level error fallback component
 */
export function ErrorFallback({ 
  title = "Terjadi Kesalahan",
  message = "Maaf, halaman ini tidak dapat dimuat.",
  onRetry,
  onGoHome
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          style={{ marginBottom: '1.5rem' }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>
          {title}
        </h2>
        
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginBottom: '1.5rem'
        }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '0.625rem 1.25rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Coba Lagi
            </button>
          )}
          
          {onGoHome && (
            <button
              onClick={onGoHome}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Ke Beranda
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
