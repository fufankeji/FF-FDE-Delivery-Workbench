/** Consistent line icons for delivery evidence and its controls. */
export function DeliveryIcon({ kind, className }: { readonly kind: string; readonly className?: string | undefined }) {
  const paths: Record<string, string> = {
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2Zm3-6a4 4 0 0 1 3 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 0a4 4 0 0 1 0 8',
    person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 22v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
    rocket: 'M9 15 4 14l3-5 4-1M9 15l1 5 5-3-1-4M9 15C8 8 15 3 21 3c0 6-5 13-12 12ZM15 8h.01M6 17l-3 4 5-2',
    return: 'M9 4 3 10l6 6M3 10h12a6 6 0 0 1 0 12',
    cases: 'M3 3h18v18H3ZM7 7h10v10H7Zm3 3h4',
    check: 'M8 12l3 3 5-6M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    book: 'M12 5v17M3 3h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v17h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z',
    shield: 'M12 3 3.5 7v6c0 4.5 4.5 7.5 8.5 9 4-1.5 8.5-4.5 8.5-9V7ZM8 12l3 3 5-6',
    database: 'M4 7v10c0 2 3.6 4 8 4s8-2 8-4V7M4 12c0 2 3.6 4 8 4s8-2 8-4',
    server: 'M5 4h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 10h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2ZM7 7.5h.01M7 17.5h.01M12 7.5h5M12 17.5h5',
    chart: 'M4 21V11h4v10m3 0V4h4v17m3 0v-7h4v7M2 21h21',
    file: 'M14 2H5v20h15V8Zm0 0v6h6M8 12h9M8 16h9M8 19h6',
    clipboard: 'M8 4H5v18h15V4h-3M9 2h7v4H9ZM8 11h9M8 15h9M8 19h6',
    code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
    graph: 'm12 6-6 11m6-11 6 11M7 19h10',
    refresh: 'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
    external: 'M14 3h7v7m0-7L10 14m0-10H4v16h16v-6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v12H5Zm7 5v3',
    history: 'M12 7v6l3 2M9 2h6m-3 0v3M5 5 3 7',
    info: 'M12 11v6m0-10v.01',
    copy: 'M9 3h12v14H9ZM5 7H3v14h12v-2',
    cube: 'm12 2 10 5v10l-10 5-10-5V7Zm0 10v10M2 7l10 5 10-5M7 4.5l10 5',
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[kind] ?? paths.file} />
    {kind === 'database' && <ellipse cx="12" cy="7" rx="8" ry="4" />}
    {kind === 'graph' && <><circle cx="12" cy="4" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /></>}
    {(kind === 'history' || kind === 'info') && <circle cx="12" cy="13" r={kind === 'history' ? 8 : 9} />}
  </svg>
}
