import { useEffect, useState } from 'react';
import { fetchFixtures } from '../lib/api.js';
import type { FixturesResponse } from '../lib/api.js';

export interface FixturesState { data: FixturesResponse | null; error: string | null; loading: boolean }

/** Loads the fixture list once on mount; ignores the result if unmounted. */
export function useFixtures(): FixturesState {
  const [state, setState] = useState<FixturesState>({data: null, error: null, loading: true});
  useEffect(() => {
    let cancelled = false;
    fetchFixtures().then(
      data => { if (!cancelled) setState({data, error: null, loading: false}); },
      error => { if (!cancelled) setState({data: null, error: error instanceof Error ? error.message : String(error), loading: false}); }
    );
    return () => { cancelled = true; };
  }, []);
  return state;
}
