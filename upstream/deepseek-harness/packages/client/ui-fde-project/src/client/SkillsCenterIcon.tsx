/** Small vector marks for the approved stage-one cards. */
export function SkillsCenterIcon({ number }: { readonly number: number }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {number === 1 && <><path d="m4 20 5-15 12-3-5 15-12 3Z" fill="currentColor" stroke="none" /><path d="m9 15 2-6 4 2-6 4Z" fill="var(--skill-icon-color)" stroke="none" /></>}
    {number === 2 && <><path d="M6 3h12v18H6z" fill="currentColor" opacity=".3" /><path d="M5 4h12v16H5zM8 3v4h10M8 11h6M8 15h7M8 18h4" /></>}
    {number === 3 && <><circle cx="9" cy="8" r="3" fill="currentColor" stroke="none" /><path d="M2 19v-2c0-3 3-5 7-5s7 2 7 5v2Z" fill="currentColor" stroke="none" /><circle cx="17" cy="6" r="2.5" fill="currentColor" stroke="none" opacity=".75" /><path d="M16 11c4 0 6 2 6 5v1h-4" fill="currentColor" stroke="none" opacity=".75" /></>}
    {number === 4 && <><circle cx="12" cy="7" r="4" fill="currentColor" stroke="none" /><path d="M3 22v-3c0-5 4-7 9-7s9 2 9 7v3Z" fill="currentColor" stroke="none" /></>}
    {number === 5 && <><ellipse cx="12" cy="5" rx="8" ry="3" fill="currentColor" stroke="none" /><path d="M4 9c0 4 16 4 16 0M4 13c0 4 16 4 16 0M4 17c0 4 16 4 16 0" strokeWidth="2.6" /></>}
    {number === 6 && <><path d="M5 3h14v18H5z" fill="currentColor" stroke="none" /><path d="M8 7h8M8 11h8M8 15h4" stroke="var(--skill-icon-color)" /><path d="m15 15 3 3-3 3" stroke="var(--skill-icon-color)" /></>}
    {number === 7 && <><path d="M3 6h18M3 12h18M3 18h18" /><circle cx="15" cy="6" r="2" fill="var(--skill-icon-color)" /><circle cx="8" cy="12" r="2" fill="var(--skill-icon-color)" /><circle cx="15" cy="18" r="2" fill="var(--skill-icon-color)" /></>}
  </svg>
}
