// Deep-link helpers for ?run=<id>: resume a run from a shared URL.
export function runIdFromLocation(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const id = params.get('run');
  return id === null || id.trim() === '' ? null : id;
}

export function runDeepLink(id: string): string {
  return `?run=${encodeURIComponent(id)}`;
}
