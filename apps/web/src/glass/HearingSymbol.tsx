import type { ReactNode } from 'react';

export type HearingSymbolName =
  | 'rider' | 'driver' | 'judge' | 'case' | 'hearing' | 'decision'
  | 'trip' | 'conversation' | 'payment' | 'history' | 'brand' | 'check' | 'review'
  | 'risk';

// Original paths share an inset grid, open counters, and a quiet tint at 24px.
const symbols: Record<HearingSymbolName, ReactNode> = {
  rider: <>
    <path d="M12 2.8c-4.5 0-7.6 3.2-7.6 7.5 0 4.7 5 9.1 7.6 11 2.6-1.9 7.6-6.3 7.6-11 0-4.3-3.1-7.5-7.6-7.5Z" fill="currentColor" fillOpacity=".09" stroke="none" />
    <path d="M7.2 16.8c-1.7-2-2.8-4.3-2.8-6.5 0-4.3 3.1-7.5 7.6-7.5s7.6 3.2 7.6 7.5c0 4.7-5 9.1-7.6 11" />
    <circle cx="12" cy="8.8" r="2.5" />
    <path d="M7.9 15.5v-.6a4.1 4.1 0 0 1 8.2 0v.6" />
  </>,
  driver: <>
    <path d="M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8Z" fill="currentColor" fillOpacity=".1" stroke="none" />
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12.2" r="2" />
    <path d="m4 9.1 6.1 2.4m9.9-2.4-6.1 2.4M12 14.2v6.3" />
  </>,
  judge: <>
    <path d="M1.5 13h6a3 3 0 0 1-6 0ZM16.5 13h6a3 3 0 0 1-6 0Z" fill="currentColor" fillOpacity=".12" />
    <path d="M12 4.8V19M4.5 7h15M4.5 7l-3 6m3-6 3 6M19.5 7l-3 6m3-6 3 6M8 21l1-2h6l1 2H8Z" />
    <circle cx="12" cy="3.5" r="1.3" fill="currentColor" fillOpacity=".12" />
  </>,
  case: <>
    <path d="M8.2 3.2h7.6l3.5 3.5v10a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2V5.2a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity=".1" stroke="none" />
    <path d="M8.2 3.2h7.6l3.5 3.5v10a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2V5.2a2 2 0 0 1 2-2ZM15.6 3.4v3.5h3.5M9.5 10.5h6.3m-6.3 3.4h4.7M3.2 7.9v11.4a2 2 0 0 0 2 2h9.1" />
  </>,
  hearing: <>
    <path d="M4.2 4.8h3c3 0 3.1 7.2 6.4 7.2h4.9M4.2 19.2h3c3 0 3.1-7.2 6.4-7.2M4.2 12h14.3" />
    <circle cx="4.2" cy="4.8" r="1.8" fill="currentColor" fillOpacity=".15" />
    <circle cx="4.2" cy="19.2" r="1.8" fill="currentColor" fillOpacity=".15" />
    <path d="m17.4 8.9 3.1 3.1-3.1 3.1" />
  </>,
  decision: <>
    <path d="M8.6 3.8h6.8c2.5 0 4.8 2.3 4.8 4.8v6.8c0 2.5-2.3 4.8-4.8 4.8H8.6c-2.5 0-4.8-2.3-4.8-4.8V8.6c0-2.5 2.3-4.8 4.8-4.8Z" fill="currentColor" fillOpacity=".1" />
    <path d="m8 12.2 2.7 2.7 5.4-5.8" />
  </>,
  trip: <>
    <path d="M6.4 18.8h8.5a3.9 3.9 0 0 0 0-7.8H9.1a3.9 3.9 0 0 1 0-7.8h8.5" />
    <circle cx="5.3" cy="18.8" r="2.4" fill="currentColor" fillOpacity=".13" />
    <path d="m15.3 1.3 3 1.9-3 2" />
  </>,
  conversation: <>
    <path d="M5.5 4.2h10a3 3 0 0 1 3 3v4.6a3 3 0 0 1-3 3H9.2l-4.9 3v-3.2a3 3 0 0 1-1.8-2.8V7.2a3 3 0 0 1 3-3Z" fill="currentColor" fillOpacity=".1" />
    <path d="M8.5 18h6.3l4.9 3v-3.2a3 3 0 0 0 1.8-2.8v-4M6.5 8.3h8m-8 3.2h5.2" />
  </>,
  payment: <>
    <rect x="2.8" y="5.1" width="18.4" height="13.8" rx="3" fill="currentColor" fillOpacity=".08" />
    <path d="M3.1 9.2h17.8M6.6 14.8h3.1" />
    <rect x="14.1" y="12.3" width="3.4" height="3.4" rx="1" fill="currentColor" fillOpacity=".15" />
  </>,
  history: <>
    <path d="M4.7 7.1A8.2 8.2 0 1 1 3.9 15" />
    <path d="M4.4 2.9v4.7h4.7M12 7.5v4.8l3.1 1.9" />
    <circle cx="12" cy="12.3" r="1.1" fill="currentColor" fillOpacity=".2" stroke="none" />
  </>,
  brand: <>
    <path d="m12 2.8 8.7 5v8.4L12 21.2l-8.7-5V7.8l8.7-5Z" fill="currentColor" fillOpacity=".1" stroke="none" />
    <path d="m12 2.8 8.7 5v8.4L12 21.2l-8.7-5V7.8l8.7-5ZM3.6 8 12 13l8.4-5M12 13v8M7.7 5.3l8.6 5" />
  </>,
  check: <>
    <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity=".09" stroke="none" />
    <path d="m7.1 12.1 3.3 3.3 6.5-6.8" />
  </>,
  review: <>
    <circle cx="10.5" cy="10.5" r="6.8" fill="currentColor" fillOpacity=".08" />
    <path d="m15.5 15.5 5 5M7.7 8.7h5.6m-5.6 3.6h3.8" />
  </>,
  risk: <>
    <path d="M12 3.2 5.2 5.9v5.3c0 4.2 2.8 7.3 6.8 8.8 4-1.5 6.8-4.6 6.8-8.8V5.9L12 3.2Z" fill="currentColor" fillOpacity=".09" stroke="none" />
    <path d="M12 3.2 5.2 5.9v5.3c0 4.2 2.8 7.3 6.8 8.8 4-1.5 6.8-4.6 6.8-8.8V5.9L12 3.2Z" />
    <path d="M12 8.2v4" />
    <circle cx="12" cy="14.9" r=".9" fill="currentColor" stroke="none" />
  </>,
};

export function HearingSymbol({name, className}: {name: HearingSymbolName; className?: string}) {
  return <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >{symbols[name]}</svg>;
}
