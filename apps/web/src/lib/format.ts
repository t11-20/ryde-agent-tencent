/** 198 → "S$1.98", 0 → "S$0.00", -300 → "-S$3.00". (SPEC §5.2) */
export function formatSgd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}S$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** 0.86 → "86%" */
export function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

const rulingLabels: Record<string, string> = {
  rider_favored: "Rider's claim upheld",
  driver_favored: "Driver's position upheld",
  incomplete: 'Incomplete',
};

const remedyLabels: Record<string, string> = {
  keep_charge: 'Keep the charge (no refund)',
  refund_route_excess: 'Refund the excess-distance charge',
  refund_no_show_fee: 'Refund the no-show fee',
};

const eventLabels: Record<string, string> = {
  'run.started': 'Run started',
  'model.start': 'Model call started',
  'model.finish': 'Model call finished',
  'tool.requested': 'Tool request',
  'evidence.retrieved': 'Evidence retrieved',
  'policy.retrieved': 'Policy retrieved',
  'case.completed': 'Case submitted',
  'output.repair': 'Output repaired',
  'judge.started': 'Handoff to the Judge',
  'run.completed': 'Ruling issued',
  'run.incomplete': 'Incomplete: needs human review',
  'run.failed': 'Run failed',
};

const actorLabels: Record<string, string> = {
  system: 'System',
  rider: 'Rider Advocate',
  driver: 'Driver Advocate',
  judge: 'Judge',
};

export function rulingLabel(ruling: string): string {
  return rulingLabels[ruling] ?? ruling;
}

export function remedyLabel(remedyId: string): string {
  return remedyLabels[remedyId] ?? remedyId;
}

export function eventLabel(type: string): string {
  return eventLabels[type] ?? type;
}

export function actorLabel(actor: string): string {
  return actorLabels[actor] ?? actor;
}
