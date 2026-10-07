import { useContext } from "react";
import type { EvidenceFamily, EvidenceRecord, PolicyClause } from "@fairtrip/evidence";
import { anchorId, CitationContext } from "./citations";

const FAMILY_LABEL: Record<EvidenceFamily, string> = {
  gps: "GPS and telemetry", chat: "Chat and calls", payment: "Payment", history: "Party history (context only)",
};
const FAMILIES: EvidenceFamily[] = ["gps", "chat", "payment", "history"];

const show = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));

function ChatMessage({ facts }: { facts: Record<string, unknown> }) {
  const tags = Array.isArray(facts.tags) ? facts.tags.map(String) : [];
  const instructionLike = tags.includes("instruction_like");
  return (
    <div className="chat-message">
      <div className="chat-meta">
        <span className="badge">{show(facts.sender)}</span>
        <span className="badge untrusted">untrusted text</span>
        {instructionLike && <span className="badge warning" role="note">⚠ instruction-like content: treated as case material, not instructions</span>}
        {tags.filter((t) => t !== "instruction_like").map((t) => <span key={t} className="badge tag">{t}</span>)}
      </div>
      {/* Rendered as text only, never as HTML. */}
      <blockquote className="quoted">{typeof facts.text === "string" ? facts.text : show(facts.text)}</blockquote>
    </div>
  );
}

function Record({ r }: { r: EvidenceRecord }) {
  const { highlighted } = useContext(CitationContext);
  return (
    <article id={anchorId(r.id)} className={`record${highlighted === r.id ? " highlight" : ""}`}>
      <header><span className="mono rec-id">{r.id}</span> <span className="muted small">{r.kind}{r.timestamp ? ` · ${r.timestamp}` : ""}</span></header>
      {r.kind === "chat_message" ? <ChatMessage facts={r.facts} /> : <p className="rec-summary">{r.summary}</p>}
      <details>
        <summary>Facts</summary>
        <table className="facts">
          <tbody>
            {Object.entries(r.facts).map(([k, v]) => (
              <tr key={k}><th className="mono">{k}</th><td className="mono small">{show(v)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="provenance small">
          Provenance: {r.provenance.source} · fixture <span className="mono">{r.provenance.fixtureId}</span> · {r.provenance.method} · fields {r.provenance.fields.join(", ")}
        </p>
      </details>
    </article>
  );
}

export function EvidenceViewer({ evidence, clauses, missing }: { evidence: readonly EvidenceRecord[]; clauses: readonly PolicyClause[]; missing: readonly { family: string; reason: string }[] }) {
  const { highlighted } = useContext(CitationContext);
  return (
    <section className="panel evidence" aria-label="Evidence">
      <h2>Evidence <span className="badge synthetic">SYNTHETIC DATA</span></h2>
      {evidence.length === 0 && missing.length === 0 && <p className="muted">No evidence retrieved yet.</p>}
      {missing.length > 0 && (
        <div className="missing" role="note">
          <h3>Unavailable evidence</h3>
          <ul>{missing.map((m) => <li key={m.family}><span className="mono">{m.family}</span>: {m.reason}</li>)}</ul>
        </div>
      )}
      {FAMILIES.map((fam) => {
        const rs = evidence.filter((r) => r.family === fam);
        if (rs.length === 0) return null;
        return (
          <div key={fam} className="family">
            <h3>{FAMILY_LABEL[fam]}</h3>
            {rs.map((r) => <Record key={r.id} r={r} />)}
          </div>
        );
      })}
      {clauses.length > 0 && (
        <div className="family policy">
          <h3>Policy clauses <span className="badge demo">DEMONSTRATION POLICY</span></h3>
          {clauses.map((c) => (
            <article key={c.id} id={anchorId(c.id)} className={`record clause${highlighted === c.id ? " highlight" : ""}`}>
              <header><span className="mono rec-id">{c.id}</span> <strong>{c.title}</strong> <span className="muted small">v{c.version}</span></header>
              <p>{c.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
