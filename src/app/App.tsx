import { useEffect, useState } from 'react';
import type { ThemePreference } from '@/domain/types';
import { applyTheme, type ResolvedTheme, readCachedPreference } from '@/lib/theme';
import { TokenSpecimen } from './TokenSpecimen';

function initialResolvedTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function App() {
  const [preference, setPreference] = useState<ThemePreference>(readCachedPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(initialResolvedTheme);

  useEffect(() => applyTheme(preference, setResolved), [preference]);

  return (
    <TokenSpecimen preference={preference} resolved={resolved} onPreferenceChange={setPreference} />
  );
}
