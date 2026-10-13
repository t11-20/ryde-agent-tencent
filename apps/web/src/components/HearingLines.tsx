import { useEffect, useState } from 'react';
import type { ActivityEvent, Run } from '@fairtrip/contracts';
import { HEARING_LANES, hearingGeometry } from '../lib/present.js';
import type { HearingLane } from '../lib/present.js';
import { Timeline } from './Timeline.js';

interface HearingLinesProps { events: ActivityEvent[]; status: Run['status'] | null }

const LABEL_W = 160;
const PAD_R = 16;
const RIDER_Y = 28;
const JUDGE_Y = 68;
const DRIVER_Y = 108;
const TICK_Y = 140;
const HEIGHT = 150;

const LANE_Y: Record<HearingLane, number> = {rider: RIDER_Y, judge: JUDGE_Y, driver: DRIVER_Y};
const LANE_LABEL: Record<HearingLane, string> = {rider: 'Rider Advocate', judge: 'Judge', driver: 'Driver Advocate'};

function useContainerWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    if (element === null) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [element]);
  return [setElement, width];
}

export function HearingLines({events, status}: HearingLinesProps) {
  const [containerRef, width] = useContainerWidth();
  const geometry = hearingGeometry(events, status);
  const plotW = Math.max(0, width - LABEL_W - PAD_R);
  const px = (x: number): number => LABEL_W + (x / 100) * plotW;
  const end = geometry.end;
  const handoff = geometry.handoff;

  // Display x per station: keep >=12px separation within a lane without
  // crossing the handoff curves or the end marker (caps may force overlap).
  const stationDx = new Map<number, number>();
  for (const lane of HEARING_LANES) {
    const laneStations = geometry.stations.filter(s => s.lane === lane);
    const cap = lane === 'judge'
      ? (end === null ? Number.POSITIVE_INFINITY : px(end.x) - 12)
      : (handoff === null ? Number.POSITIVE_INFINITY : px(handoff.x) - 44);
    let prev = Number.NEGATIVE_INFINITY;
    for (const s of laneStations) {
      const floor = lane === 'judge' && handoff !== null && s.seconds >= handoff.seconds ? px(handoff.x) + 14 : Number.NEGATIVE_INFINITY;
      const dx = Math.min(Math.max(px(s.x), prev + 12, floor), cap);
      stationDx.set(s.sequence, dx);
      prev = dx;
    }
  }
  const segmentDx = (segment: {lane: HearingLane; x1: number; x2: number}) => {
    const laneStations = geometry.stations.filter(s => s.lane === segment.lane);
    const first = laneStations[0];
    const last = laneStations[laneStations.length - 1];
    const firstDx = first === undefined ? px(segment.x1) : (stationDx.get(first.sequence) ?? px(segment.x1));
    const lastDx = last === undefined ? px(segment.x2) : (stationDx.get(last.sequence) ?? px(segment.x2));
    const x1 = segment.lane === 'judge' && handoff !== null ? px(handoff.x) : firstDx;
    const x2 = segment.lane === 'judge' && end !== null ? px(end.x) : lastDx;
    return {x1, x2};
  };

  const endAnchorEnd = end !== null && end.x > 85;

  return (
    <section className="panel lines" aria-labelledby="lines-heading">
      <h2 id="lines-heading" className="panel-title">Hearing lines</h2>
      <div ref={containerRef} className="lines-figure">
        <svg
          role="group"
          aria-label="Hearing lines: agent activity on a time axis"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
        >
          {geometry.rails.map(rail => (
            <text key={`label-${rail.lane}`} x={0} y={LANE_Y[rail.lane] + 5} className={`lane-label lane-label-${rail.lane}`}>
              {LANE_LABEL[rail.lane]}
            </text>
          ))}
          {geometry.rails.map(rail => (
            <line
              key={`rail-${rail.lane}`}
              x1={px(rail.x1)} y1={LANE_Y[rail.lane]} x2={px(rail.x2)} y2={LANE_Y[rail.lane]}
              className={`lane-rail lane-rail-${rail.lane}`}
            />
          ))}
          {geometry.segments.map((segment, index) => {
            const {x1, x2} = segmentDx(segment);
            return (
              <line
                key={`seg-${segment.lane}-${index}`}
                x1={x1} y1={LANE_Y[segment.lane]} x2={x2} y2={LANE_Y[segment.lane]}
                className={`lane-segment lane-segment-${segment.lane}`}
              />
            );
          })}
          {handoff === null ? null : (
            <>
              <path
                d={`M ${Math.max(LABEL_W, px(handoff.x) - 40)} ${RIDER_Y} C ${px(handoff.x) - 16} ${RIDER_Y}, ${px(handoff.x) - 16} ${JUDGE_Y}, ${px(handoff.x)} ${JUDGE_Y}`}
                className="handoff-curve handoff-curve-rider"
              />
              <path
                d={`M ${Math.max(LABEL_W, px(handoff.x) - 40)} ${DRIVER_Y} C ${px(handoff.x) - 16} ${DRIVER_Y}, ${px(handoff.x) - 16} ${JUDGE_Y}, ${px(handoff.x)} ${JUDGE_Y}`}
                className="handoff-curve handoff-curve-driver"
              />
              <g role="img" aria-label={handoff.title} className="station station-handoff">
                <title>{handoff.title}</title>
                <circle cx={px(handoff.x)} cy={JUDGE_Y} r={7} className="station-dot station-dot-handoff" />
              </g>
              <text x={px(handoff.x) + 12} y={JUDGE_Y + 22} className="lines-handoff-note">Both cases handed to the Judge</text>
            </>
          )}
          {geometry.stations.map(station => (
            <g key={station.sequence} role="img" aria-label={station.title} className={`station station-${station.actor}`}>
              <title>{station.title}</title>
              <circle cx={stationDx.get(station.sequence) ?? px(station.x)} cy={LANE_Y[station.lane]} r={5} className={`station-dot station-dot-${station.actor}`} />
            </g>
          ))}
          {end === null ? null : (
            <g role="img" aria-label={end.title} className={`end-marker end-marker-${end.kind}`}>
              <title>{end.title}</title>
              {end.kind === 'failed' ? (
                <g className="end-cross">
                  <line x1={px(end.x) - 6} y1={JUDGE_Y - 6} x2={px(end.x) + 6} y2={JUDGE_Y + 6} />
                  <line x1={px(end.x) - 6} y1={JUDGE_Y + 6} x2={px(end.x) + 6} y2={JUDGE_Y - 6} />
                </g>
              ) : (
                <circle cx={px(end.x)} cy={JUDGE_Y} r={7} className={`end-dot end-dot-${end.kind}`} />
              )}
              <text
                x={endAnchorEnd ? px(end.x) + 8 : px(end.x)}
                y={JUDGE_Y - 14}
                textAnchor={endAnchorEnd ? 'end' : 'middle'}
                className={`end-label end-label-${end.kind}`}
              >
                {end.label}
              </text>
            </g>
          )}
          {geometry.ticks.map((tick, index) => (
            <text
              key={tick.label}
              x={px(tick.x)}
              y={TICK_Y}
              textAnchor={index === 0 ? 'start' : 'middle'}
              className="lines-tick"
            >
              {tick.label}
            </text>
          ))}
        </svg>
      </div>
      {events.length === 0 ? null : (
        <details className="lines-log">
          <summary>Show full activity log</summary>
          <Timeline events={events} />
        </details>
      )}
    </section>
  );
}
