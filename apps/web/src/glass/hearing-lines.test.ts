import { describe, expect, it } from 'vitest';
import type { ActivityEvent } from '@fairtrip/contracts';
import { event } from '../lib/test-runs.js';
import { hearingPoints } from './LiquidHearingLines.js';

const advocateEvents: ActivityEvent[] = [
  event(1, 'system', 'run.started'),
  event(2, 'rider', 'evidence.retrieved'),
  event(3, 'rider', 'case.completed'),
  event(4, 'driver', 'evidence.retrieved'),
  event(5, 'driver', 'case.completed'),
];

describe('glass hearingPoints', () => {
  it('places the risk assessment on its own lane and the Judge review on the judge lane', () => {
    const events = [...advocateEvents, event(6, 'risk', 'risk.assessed'), event(7, 'judge', 'judge.started')];
    const points = hearingPoints(events, null, false);
    const riskPoint = points.find(point => point.lane === 'risk');
    expect(riskPoint?.stage).toBe('case');
    expect(riskPoint?.label).toBe('Assessment ready');
    const judgePoint = points.find(point => point.event.type === 'judge.started');
    expect(judgePoint?.lane).toBe('judge');
    expect(judgePoint?.stage).toBe('review');
    expect(judgePoint?.label).toBe('Judge review');
  });

  it('has no risk lane point when the run never assessed risk', () => {
    const points = hearingPoints([...advocateEvents, event(6, 'judge', 'judge.started')], null, false);
    expect(points.some(point => point.lane === 'risk')).toBe(false);
  });

  it('orders the precedents checkpoint before the Judge review', () => {
    const events = [...advocateEvents, event(6, 'precedent', 'precedent.retrieved'), event(7, 'judge', 'judge.started')];
    const points = hearingPoints(events, null, false);
    const precedents = points.find(point => point.label === 'Precedents checked');
    const review = points.find(point => point.label === 'Judge review');
    expect(precedents?.lane).toBe('judge');
    expect(precedents?.stage).toBe('review');
    expect(review).toBeDefined();
    expect(precedents?.event.sequence).toBeLessThan(review?.event.sequence ?? Number.POSITIVE_INFINITY);
  });
});
