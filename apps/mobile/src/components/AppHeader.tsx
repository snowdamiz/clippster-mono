import type { ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
}

/** @deprecated Prefer ScreenHeader — kept as a thin alias for existing call sites. */
export function AppHeader({ title, subtitle, showBack, rightAction }: AppHeaderProps) {
  return (
    <ScreenHeader title={title} subtitle={subtitle} showBack={showBack} rightAction={rightAction} />
  );
}
