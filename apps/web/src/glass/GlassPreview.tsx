import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { RecordedHearing } from './RecordedHearing.js';
import { LiveHearing } from './LiveHearing.js';
import { HearingSymbol } from './HearingSymbol.js';

const PERSPECTIVES = [
  {id: 'rider', label: 'Rider', title: 'Rider advocate', detail: ['Represents the rider’s concern', 'Builds a case from trip evidence']},
  {id: 'judge', label: 'Judge', title: 'Independent judge', detail: ['Weighs both sides', 'Applies the demonstration policy']},
  {id: 'driver', label: 'Driver', title: 'Driver advocate', detail: ['Represents the driver’s response', 'Reviews the same trip evidence']},
] as const;

const JOURNEY = [
  {label: 'Choose a case', detail: 'Explore a trip scenario', target: '.glass-case-segment', icon: 'case'},
  {label: 'Follow the hearing', detail: 'See both sides unfold', target: '.glass-timeline', icon: 'hearing'},
  {label: 'See the decision', detail: 'Understand the outcome', target: '.glass-verdict', icon: 'decision'},
] as const;

const LIQUID_SURFACES = [
  '.glass-toolbar', '.glass-intro-card', '.glass-footer',
  '.glass-content .panel', '.glass-content .casebar-claim',
  '.glass-content .evidence-card', '.glass-content .policy-clause',
  '.glass-content .gauges > .gauge', '.glass-process > button',
].join(', ');

function LiquidPrism() {
  const [perspective, setPerspective] = useState(1);
  const [rotation, setRotation] = useState({x: 16, y: -20});
  const [dragging, setDragging] = useState(false);
  const start = useRef<{pointer: number; x: number; y: number; rotationX: number; rotationY: number} | null>(null);
  const reducedMotion = useRef(false);
  const current = PERSPECTIVES[perspective] ?? PERSPECTIVES[1];
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = query.matches; };
    update();
    query.addEventListener('change', update);
    return () => { query.removeEventListener('change', update); };
  }, []);
  const canMove = () => !reducedMotion.current;
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (!canMove() || event.button !== 0 || event.pointerType === 'touch') return;
    start.current = {pointer: event.pointerId, x: event.clientX, y: event.clientY, rotationX: rotation.x, rotationY: rotation.y};
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const initial = start.current;
    if (initial === null || initial.pointer !== event.pointerId || !canMove()) return;
    setRotation({
      x: Math.max(-30, Math.min(35, initial.rotationX - (event.clientY - initial.y) * .18)),
      y: Math.max(-50, Math.min(50, initial.rotationY + (event.clientX - initial.x) * .22)),
    });
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current?.pointer !== event.pointerId) return;
    start.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canMove() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { setRotation({x: 16, y: -20}); return; }
    setRotation(value => ({
      x: Math.max(-30, Math.min(35, value.x + (event.key === 'ArrowUp' ? -5 : event.key === 'ArrowDown' ? 5 : 0))),
      y: Math.max(-50, Math.min(50, value.y + (event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0))),
    }));
  };

  return (
    <div className="glass-intro-card glass-lens" data-perspective={current.id}>
      <div className="glass-lens-head"><span className="glass-eyebrow">Meet your three agents</span></div>
      <div className="glass-prism" role="group" aria-label="Rotate the three glass perspectives" aria-describedby="glass-prism-help" tabIndex={0} data-dragging={dragging} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { start.current = null; setDragging(false); }} onKeyDown={key}>
        <div className="glass-prism-floor" aria-hidden="true" />
        <div className="glass-prism-stack" style={{transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`}} aria-hidden="true">
          {PERSPECTIVES.map((side, index) => (
            <div key={side.id} className={`glass-prism-sheet glass-prism-${side.id}`} data-active={index === perspective}>
              <div className="glass-prism-caustic" />
              <span className="glass-prism-index">0{index + 1}</span>
              <div className="glass-prism-symbol"><HearingSymbol name={side.id} /></div>
              <span className="glass-prism-name">{side.label}</span><span className="glass-prism-line" />
            </div>
          ))}
        </div>
      </div>
      <div className="glass-perspectives" role="group" aria-label="Explore a perspective">
        {PERSPECTIVES.map((side, index) => <button key={side.id} type="button" aria-pressed={index === perspective} onClick={() => { setPerspective(index); setRotation({x: 14, y: index === 0 ? -24 : index === 2 ? 16 : -12}); }}><HearingSymbol name={side.id} />{side.label}</button>)}
      </div>
      <div className="glass-lens-copy" aria-live="polite"><p>{current.title}</p><ul>{current.detail.map(point => <li key={point}>{point}</li>)}</ul></div>
      <p id="glass-prism-help" className="glass-prism-help">Choose an agent · Drag to rotate<span className="visually-hidden">. Keyboard: arrow keys to rotate, Home to reset.</span></p>
    </div>
  );
}

export function GlassPreview() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [source, setSource] = useState<'recorded' | 'live'>('recorded');
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = preview.current;
    if (root === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let active: HTMLElement | null = null;
    let pending: {panel: HTMLElement; x: number; y: number} | null = null;
    const reset = () => {
      if (active !== null) {
        active.style.removeProperty('--liquid-rx'); active.style.removeProperty('--liquid-ry');
        active.style.removeProperty('--liquid-x'); active.style.removeProperty('--liquid-y');
        active.removeAttribute('data-liquid-active');
      }
      active = null;
    };
    const update = () => {
      frame = 0;
      if (pending === null || reduced.matches) { reset(); return; }
      const {panel, x, y} = pending;
      if (!panel.isConnected) { reset(); return; }
      if (active !== panel) { reset(); active = panel; }
      const rect = panel.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((x - rect.left) / Math.max(1, rect.width) - .5) * 2));
      const ny = Math.max(-1, Math.min(1, ((y - rect.top) / Math.max(1, rect.height) - .5) * 2));
      const depth = rect.width > 700 ? 1.4 : panel.classList.contains('panel') ? 3 : 3.6;
      panel.style.setProperty('--liquid-rx', `${-ny * depth}deg`);
      panel.style.setProperty('--liquid-ry', `${nx * depth}deg`);
      panel.style.setProperty('--liquid-x', `${(nx + 1) * 50}%`);
      panel.style.setProperty('--liquid-y', `${(ny + 1) * 50}%`);
      panel.setAttribute('data-liquid-active', 'true');
    };
    const move = (event: globalThis.PointerEvent) => {
      if (reduced.matches || event.pointerType === 'touch') return;
      const panel = event.target instanceof Element ? event.target.closest<HTMLElement>(LIQUID_SURFACES) : null;
      // The sculpture has its own rotation gesture; leave it independent of card tilt.
      if (event.target instanceof Element && event.target.closest('.glass-prism') !== null) {
        pending = null;
        if (frame === 0) frame = window.requestAnimationFrame(update);
        return;
      }
      pending = panel === null ? null : {panel, x: event.clientX, y: event.clientY};
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    const leave = () => { pending = null; if (frame !== 0) window.cancelAnimationFrame(frame); frame = 0; reset(); };
    const preference = () => { if (reduced.matches) leave(); };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', leave);
    root.addEventListener('pointercancel', leave);
    reduced.addEventListener('change', preference);
    return () => {
      leave(); root.removeEventListener('pointermove', move); root.removeEventListener('pointerleave', leave);
      root.removeEventListener('pointercancel', leave); reduced.removeEventListener('change', preference);
    };
  }, [source]);

  return (
    <div ref={preview} className="glass-preview" data-theme={theme} data-motion="on">
      <div className="glass-atmosphere" aria-hidden="true">
        <div className="glass-orb glass-orb-blue" />
        <div className="glass-orb glass-orb-violet" />
        <div className="glass-orb glass-orb-green" />
        <div className="glass-grid" />
      </div>
      <a className="glass-skip" href="#glass-content">Skip to hearing</a>
      <nav className="glass-toolbar" aria-label="Hearing controls">
        <a className="glass-wordmark" href="#glass-title" aria-label="FairTrip home">
          <HearingSymbol name="brand" />
          <span>FairTrip<span className="glass-wordmark-note">For Ryde</span></span>
        </a>
        <div className="glass-source" role="group" aria-label="Hearing mode">
          <button type="button" aria-pressed={source === 'recorded'} onClick={() => { setSource('recorded'); }}>Explore cases</button>
          <button type="button" aria-pressed={source === 'live'} onClick={() => { setSource('live'); }}>Live hearing</button>
        </div>
        <div className="glass-settings">
          <button type="button" className="glass-icon-button" onClick={() => { setTheme(value => value === 'light' ? 'dark' : 'light'); }} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
            )}
          </button>
        </div>
      </nav>
      <section className="glass-intro" aria-labelledby="glass-title">
        <div className="glass-intro-card glass-intro-copy">
          <p className="glass-eyebrow"><span className="glass-status-dot" /> Your hearing room</p>
          <h1 id="glass-title">Every side heard.<span>A clearer way forward.</span></h1>
          <ul className="glass-hero-points"><li>Rider and driver represented</li><li>Evidence behind every decision</li><li>A clear outcome, when evidence allows</li></ul>
          <div className="glass-process" aria-label="Explore the hearing">
            {JOURNEY.map((step, index) => <button type="button" key={step.label} onClick={() => {
              const target = document.querySelector<HTMLElement>(step.target);
              target?.scrollIntoView({behavior: !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto', block: 'start'});
              if (target !== null) { target.tabIndex = -1; target.focus({preventScroll: true}); }
            }}><span className="glass-journey-asset" aria-hidden="true"><HearingSymbol name={step.icon} /></span><span className="glass-journey-number">0{index + 1}</span><strong>{step.label}</strong><small>{step.detail}</small></button>)}
          </div>
          <div className="glass-context">
            <span className="glass-context-note">Prototype · Synthetic cases · Demonstration policy</span>
          </div>
        </div>
        <LiquidPrism />
      </section>
      <div id="glass-content" className="glass-content" tabIndex={-1}>
        {source === 'recorded' ? <RecordedHearing /> : <LiveHearing />}
      </div>
      <footer className="glass-footer">
        <span>Evidence before assumptions.</span>
        <span>FairTrip · Ryde dispute resolution prototype</span>
      </footer>
    </div>
  );
}
