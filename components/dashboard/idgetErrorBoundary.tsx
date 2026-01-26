// src/components/dashboard/WidgetErrorBoundary.tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Widget Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="border-dashed border-red-200 bg-red-50/50 dark:bg-red-950/10 h-full min-h-[150px] flex items-center justify-center">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-200">Widget Unavailable</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80">Could not load this section.</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs border-red-200 hover:bg-red-100"
              onClick={() => this.setState({ hasError: false })}
            >
              <RefreshCcw className="w-3 h-3 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}