import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { captureException } from '@/services/crashReporting';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary', error, info.componentStack);
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-background px-6">
          <EmptyState icon="alert-circle-outline" title="Something went wrong" subtitle="We couldn’t load this screen. Try again to reopen it." />
          <Button title="Try again" onPress={() => this.setState({ hasError: false, message: '' })} />
        </View>
      );
    }

    return this.props.children;
  }
}
