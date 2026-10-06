"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { QrSvg } from "../../../shared/qr";
import { Crest } from "../crest";
import { accentVars, LIVE_FONT_FAMILY } from "../live-style";
import { useTvStage } from "../use-tv-stage";
import type { VoteBoard, VoteBoardSide, VoteEntry } from "../vote-board";
import { getVoteBoardAction } from "./actions";

export type VoteTvPin = "match" | "favorite" | null;

const PAGE_MS = 15_000;
const POLL_MS = 10_000;

// Palco de 1920px escalado (shared/tv-stage.ts), CSS próprio, cor de destaque por variável.
const CSS = `
  html, body { margin: 0; background: #0a0d12; overflow: hidden; }
  .gm-vt-viewport, .gm-vt-viewport * { box-sizing: border-box; }
  .gm-vt-viewport { position: fixed; inset: 0; overflow: hidden; background: #0a0d12; }
  .gm-vt { position: absolute; top: 0; left: 0; transform-origin: top left; display: flex; flex-direction: column;
    font-family: ${LIVE_FONT_FAMILY}; color: #fff; -webkit-font-smoothing: antialiased;
    background: radial-gradient(120% 140% at 50% -10%, #17202b 0%, #0a0d12 55%); }
  .gm-vt-head { display: flex; align-items: center; justify-content: space-between; gap: 40px; padding: 44px 72px 0; }
  .gm-vt-eyebrow { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
  .gm-vt-title { margin: 6px 0 0; font-size: 72px; font-weight: 800; line-height: 1; text-transform: uppercase; }
  .gm-vt-title-bar { width: 96px; height: 7px; border-radius: 999px; background: var(--gm-accent); margin-top: 16px; }
  .gm-vt-logo { height: 120px; max-width: 420px; width: auto; object-fit: contain; }

  .gm-vt-body { flex: 1; min-height: 0; display: flex; gap: 44px; padding: 30px 72px 40px; }
  .gm-vt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; animation: gm-vt-fade 420ms ease-out both; }

  .gm-vt-match { display: flex; align-items: center; gap: 20px; }
  .gm-vt-crest { flex: none; width: 70px; height: 70px; border-radius: 999px; object-fit: cover; background: rgba(255,255,255,0.08);
    border: 4px solid var(--gm-team, rgba(255,255,255,0.2)); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #fff; }
  .gm-vt-match-name { min-width: 0; font-size: 42px; font-weight: 800; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-vt-vs { font-size: 34px; font-weight: 700; font-style: italic; color: rgba(255,255,255,0.4); }
  .gm-vt-badge { margin-left: auto; flex: none; padding: 8px 22px; border-radius: 999px; font-size: 24px; font-weight: 800; letter-spacing: 2px;
    text-transform: uppercase; background: var(--gm-accent); color: var(--gm-accent-ink); }
  .gm-vt-badge.closed { background: rgba(255,255,255,0.14); color: #fff; }

  .gm-vt-list { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
  .gm-vt-row { position: relative; display: flex; align-items: center; gap: 24px; padding: 14px 28px; border-radius: 22px; overflow: hidden;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
  .gm-vt-row.lead { border-color: color-mix(in srgb, var(--gm-accent) 60%, transparent); }
  .gm-vt-fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--gm-row, var(--gm-accent)) 28%, transparent);
    transition: width 700ms cubic-bezier(0.2, 0.9, 0.2, 1); }
  .gm-vt-rank { position: relative; flex: none; width: 64px; text-align: center; font-size: 40px; font-weight: 800; color: rgba(255,255,255,0.55); }
  .gm-vt-avatar { position: relative; flex: none; width: 88px; height: 88px; border-radius: 999px; object-fit: cover; background: rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; color: #fff; box-shadow: 0 8px 18px -6px rgba(0,0,0,0.5); }
  .gm-vt-list.compact .gm-vt-avatar { width: 64px; height: 64px; font-size: 22px; }
  .gm-vt-names { position: relative; flex: 1; min-width: 0; }
  .gm-vt-name { font-size: 44px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.05; }
  .gm-vt-list.compact .gm-vt-name { font-size: 36px; }
  .gm-vt-sub { font-size: 26px; font-weight: 600; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-vt-pct { position: relative; flex: none; text-align: right; }
  .gm-vt-pct-value { font-size: 54px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--gm-accent); line-height: 1; }
  .gm-vt-list.compact .gm-vt-pct-value { font-size: 44px; }
  .gm-vt-pct-votes { font-size: 22px; font-weight: 600; color: rgba(255,255,255,0.55); font-variant-numeric: tabular-nums; }
  .gm-vt-total { margin: 0; font-size: 26px; font-weight: 600; color: rgba(255,255,255,0.5); }
  .gm-vt-empty { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 40px;
    font-size: 44px; font-weight: 600; color: rgba(255,255,255,0.5); }

  .gm-vt-qr-panel { flex: none; width: 470px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 36px;
    border-radius: 30px; background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.12); }
  .gm-vt-qr-title { margin: 0; font-size: 44px; font-weight: 800; text-align: center; line-height: 1.05; text-transform: uppercase; }
  .gm-vt-qr { width: 360px; height: 360px; padding: 20px; border-radius: 26px; background: #fff; }
  .gm-vt-qr svg { display: block; width: 100%; height: 100%; }
  .gm-vt-qr-url { margin: 0; font-size: 26px; font-weight: 700; text-align: center; color: rgba(255,255,255,0.85); overflow-wrap: anywhere; }

  .gm-vt-foot { padding: 0 72px 36px; }
  .gm-vt-bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.1); overflow: hidden; }
  .gm-vt-bar-fill { height: 100%; border-radius: 999px; background: var(--gm-accent); }
  @keyframes gm-vt-progress { from { width: 0%; } to { width: 100%; } }
  @keyframes gm-vt-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
`;

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Rows({ entries, compact, emptyMessage }: { entries: VoteEntry[]; compact: boolean; emptyMessage: string }) {
  if (entries.length === 0) return <p className="gm-vt-empty">{emptyMessage}</p>;
  return (
    <div className={`gm-vt-list ${compact ? "compact" : ""}`}>
      {entries.map((entry) => (
        <div key={entry.id} className={`gm-vt-row ${entry.position === 1 ? "lead" : ""}`} style={{ "--gm-row": entry.color ?? undefined } as CSSProperties}>
          <span className="gm-vt-fill" style={{ width: `${entry.percent}%` }} />
          <span className="gm-vt-rank">{MEDAL[entry.position] ?? `${entry.position}º`}</span>
          <Crest url={entry.imageUrl} name={entry.name} className="gm-vt-avatar" />
          <div className="gm-vt-names">
            <div className="gm-vt-name">{entry.name}</div>
            {entry.subtitle ? <div className="gm-vt-sub">{entry.subtitle}</div> : null}
          </div>
          <div className="gm-vt-pct">
            <div className="gm-vt-pct-value">{entry.percent}%</div>
            <div className="gm-vt-pct-votes">
              {entry.votes} voto{entry.votes === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Side({ side }: { side: VoteBoardSide }) {
  return (
    <>
      <Crest url={side.crestUrl} name={side.name} className="gm-vt-crest" style={{ "--gm-team": side.color ?? undefined } as CSSProperties} />
      <span className="gm-vt-match-name">{side.name}</span>
    </>
  );
}

function totalLabel(total: number): string {
  return `${total} voto${total === 1 ? "" : "s"} no total`;
}

export function VoteTvCanvas({
  initialBoard,
  qr,
  displayUrl,
  pin,
  competitionName,
  logoUrl,
  accentColor,
  accentInk,
}: {
  initialBoard: VoteBoard | null;
  qr: QrSvg;
  displayUrl: string;
  pin: VoteTvPin;
  competitionName: string;
  logoUrl: string | null;
  accentColor: string;
  accentInk: string;
}) {
  const [board, setBoard] = useState(initialBoard);
  const stage = useTvStage();

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      getVoteBoardAction()
        .then((next) => {
          if (!cancelled && next) setBoard(next);
        })
        .catch(() => {
          // rede instável — próximo ciclo tenta de novo
        });
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const available: ("match" | "favorite")[] = [];
  if (board?.match) available.push("match");
  if (board?.favorite && (board.favorite.isOpen || board.favorite.total > 0)) available.push("favorite");
  const pages = pin ? available.filter((page) => page === pin) : available;

  const [index, setIndex] = useState(0);
  const safeIndex = pages.length === 0 ? 0 : index % pages.length;
  const current = pages[safeIndex] ?? null;

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % pages.length), PAGE_MS);
    return () => clearTimeout(timer);
  }, [safeIndex, pages.length]);

  const title = current === "match" ? "Craque da torcida" : current === "favorite" ? "Equipe favorita" : "Votação da torcida";

  return (
    <>
      <style>{CSS}</style>
      <div className="gm-vt-viewport" style={accentVars(accentColor, accentInk)}>
        <div className="gm-vt" style={{ width: stage.stageWidthPx, height: stage.stageHeightPx, transform: `scale(${stage.scale})` }}>
          <header className="gm-vt-head">
            <div>
              <p className="gm-vt-eyebrow">{competitionName} · Votação da torcida</p>
              <h1 className="gm-vt-title">{title}</h1>
              <div className="gm-vt-title-bar" />
            </div>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- tela standalone (TV)
              <img className="gm-vt-logo" src={logoUrl} alt="" />
            ) : null}
          </header>

          <div className="gm-vt-body">
            <main key={current ?? "none"} className="gm-vt-main">
              {current === "match" && board?.match ? (
                <>
                  <div className="gm-vt-match">
                    <Side side={board.match.home} />
                    <span className="gm-vt-vs">×</span>
                    <Side side={board.match.away} />
                    <span className={`gm-vt-badge ${board.match.isOpen ? "" : "closed"}`}>{board.match.isOpen ? "Parcial" : "Resultado final"}</span>
                  </div>
                  <Rows entries={board.match.entries} compact={false} emptyMessage="Nenhum voto ainda — aponte a câmera pro QR e escolha o craque do jogo!" />
                  {board.match.total > 0 ? <p className="gm-vt-total">{totalLabel(board.match.total)}</p> : null}
                </>
              ) : current === "favorite" && board?.favorite ? (
                <>
                  <div className="gm-vt-match">
                    <span className="gm-vt-match-name">{board.favorite.title}</span>
                    <span className={`gm-vt-badge ${board.favorite.isOpen ? "" : "closed"}`}>{board.favorite.isOpen ? "Parcial" : "Votação encerrada"}</span>
                  </div>
                  <Rows entries={board.favorite.entries} compact emptyMessage="Nenhum voto ainda — qual é a sua equipe favorita?" />
                  {board.favorite.total > 0 ? <p className="gm-vt-total">{totalLabel(board.favorite.total)}</p> : null}
                </>
              ) : (
                <p className="gm-vt-empty">A votação do craque da torcida abre no apito inicial de cada jogo.</p>
              )}
            </main>

            <aside className="gm-vt-qr-panel">
              <p className="gm-vt-qr-title">Vote pelo celular</p>
              <div className="gm-vt-qr">
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label="QR code da votação">
                  <path d={qr.path} fill="#000000" />
                </svg>
              </div>
              <p className="gm-vt-qr-url">{displayUrl}</p>
            </aside>
          </div>

          {pages.length > 1 ? (
            <footer className="gm-vt-foot">
              <div className="gm-vt-bar">
                <div key={safeIndex} className="gm-vt-bar-fill" style={{ animation: `gm-vt-progress ${PAGE_MS}ms linear forwards` }} />
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </>
  );
}
