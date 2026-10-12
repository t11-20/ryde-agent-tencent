import { describe, expect, it } from 'vitest';
import { actorLabel, eventLabel, formatSgd, percent, remedyLabel, rulingLabel } from './format.js';

describe('formatSgd (SPEC §5.2 vectors)', () => {
  it('formats positive cents', () => { expect(formatSgd(198)).toBe('S$1.98'); });
  it('formats zero', () => { expect(formatSgd(0)).toBe('S$0.00'); });
  it('formats negative cents', () => { expect(formatSgd(-300)).toBe('-S$3.00'); });
});

describe('percent', () => {
  it('rounds confidence to a percentage string', () => { expect(percent(0.86)).toBe('86%'); });
});

describe('labels (SPEC §12.2)', () => {
  it('names the judge handoff event', () => { expect(eventLabel('judge.started')).toBe('Handoff to the Judge'); });
  it('names rulings', () => {
    expect(rulingLabel('rider_favored')).toBe("Rider's claim upheld");
    expect(rulingLabel('driver_favored')).toBe("Driver's position upheld");
    expect(rulingLabel('incomplete')).toBe('Incomplete');
  });
  it('names remedies', () => {
    expect(remedyLabel('keep_charge')).toBe('Keep the charge (no refund)');
    expect(remedyLabel('refund_route_excess')).toBe('Refund the excess-distance charge');
    expect(remedyLabel('refund_no_show_fee')).toBe('Refund the no-show fee');
  });
  it('names actors', () => { expect(actorLabel('rider')).toBe('Rider Advocate'); });
});

describe('fallback', () => {
  it('unknown values fall back to themselves', () => {
    expect(rulingLabel('something_else')).toBe('something_else');
    expect(remedyLabel('something_else')).toBe('something_else');
    expect(eventLabel('something_else')).toBe('something_else');
    expect(actorLabel('something_else')).toBe('something_else');
  });
});
