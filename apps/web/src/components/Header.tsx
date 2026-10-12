interface HeaderProps { mode: string }

function modeBadge(mode: string): {text: string; live: boolean} | null {
  if (mode === 'live') return {text: 'LIVE MODEL', live: true};
  if (mode === 'stub') return {text: 'STUB', live: false};
  if (mode === '') return null;
  return {text: mode.toUpperCase(), live: false};
}

export function Header({mode}: HeaderProps) {
  const badge = modeBadge(mode);
  return (
    <header className="header">
      <div>
        <h1 className="header-product">FairTrip</h1>
        <p className="header-sub">Ryde dispute resolution prototype</p>
      </div>
      <div className="header-badges">
        <span className="badge">DEMONSTRATION POLICY</span>
        <span className="badge">SYNTHETIC DATA</span>
        {badge === null ? null : <span className={badge.live ? 'badge badge-live' : 'badge'}>{badge.text}</span>}
      </div>
    </header>
  );
}
