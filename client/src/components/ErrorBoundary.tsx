import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);
    console.error("Component stack:", errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-red-600">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  The application encountered an error. Please try refreshing the page.
                </p>
                {this.state.error && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                      Error Details
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-64">
                      <code>{this.state.error.toString()}</code>
                      {this.state.errorInfo && (
                        <>
                          {"\n\n"}
                          <code>{this.state.errorInfo.componentStack}</code>
                        </>
                      )}
                    </pre>
                  </details>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                >
                  <i className="fas fa-sync-alt mr-2"></i>
                  Refresh Page
                </Button>
                <Button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
