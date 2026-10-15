interface HeaderProps { mode: string; recordedAt?: string }

export function modeLabel(mode: string, recordedAt?: string): string | null {
  if (mode === 'live') return 'Live model';
  if (mode === 'stub') return 'Stub';
  if (mode === 'replay') return recordedAt === undefined ? 'Replay of live run' : `Replay of live run · recorded ${recordedAt.slice(0, 10)}`;
  if (mode === '') return null;
  return mode;
}

export function Header({mode, recordedAt}: HeaderProps) {
  const modeText = modeLabel(mode, recordedAt);
  return (
    <header className="header">
      <h1 className="header-title">FairTrip</h1>
      <p className="header-sub">Ryde dispute resolution prototype</p>
      <div className="header-notes">
        <span className="header-note">Demonstration policy</span>
        <span className="header-note">Synthetic data</span>
        {modeText === null ? null : <span className="header-note">{modeText}</span>}
      </div>
    </header>
  );
}
