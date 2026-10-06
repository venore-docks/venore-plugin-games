"use client";

import { useState, type CSSProperties } from "react";
import type { LiveMarker, LiveMatchState, LiveSideState, MatchSide } from "../../../contracts/types";
import { elapsedMs, formatClock } from "../../../shared/clock";
import { formatScore } from "../../../shared/score";
import { getSportProfile } from "../../../shared/sport-profiles";
import { useLiveState, useNow } from "../../../shared/use-live-state";
import { accentVars, LIVE_FONT_FAMILY, monogram } from "../live-style";

export type OverlayPosition = "bottom" | "top";

// Placar do OBS. Fora do tema do site: CSS próprio, px fixos (a fonte de navegador do OBS tem
// resolução fixa) e cor de destaque por variável. Barra centralizada: nome · brasão · [placa com
// os números e o medalhão da competição] · brasão · nome. Marcadores (cartões, 2 min, power
// plays) ficam acima do lado de cada equipe até serem tirados no controle; o destaque do ponto
// ("GOL!") aparece por alguns segundos e some sozinho. Relógio/etiqueta num canto discreto à
// direita, na mesma linha da barra.
const CSS = `
  html, body { background: transparent !important; margin: 0; overflow: hidden; }
  .gm-o { position: fixed; inset: 0; pointer-events: none; font-family: ${LIVE_FONT_FAMILY}; -webkit-font-smoothing: antialiased; color: #fff; }
  .gm-o-strip { position: absolute; left: 0; right: 0; bottom: 56px; display: flex; justify-content: center; }
  .gm-o.top .gm-o-strip { top: 48px; bottom: auto; }

  .gm-o-bar { position: relative; display: flex; align-items: stretch; border-radius: 22px;
    background: linear-gradient(180deg, rgba(15,20,26,0.92), rgba(8,11,15,0.95));
    border: 1px solid rgba(255,255,255,0.09); border-top-color: rgba(255,255,255,0.22);
    box-shadow: 0 30px 70px rgba(0,0,0,0.55), 0 8px 24px color-mix(in srgb, var(--gm-accent) 16%, transparent), inset 0 1px 0 rgba(255,255,255,0.07);
    animation: gm-o-rise 460ms ease-out both; }
  .gm-o-bar::after { content: ""; position: absolute; left: 14%; right: 14%; bottom: 0; height: 3px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, var(--gm-accent), transparent); }

  .gm-o-team { display: flex; align-items: center; gap: 18px; width: 470px; padding: 0 26px; }
  .gm-o-team.home { justify-content: flex-end; }
  .gm-o-team.away { justify-content: flex-start; }
  .gm-o-name { min-width: 0; font-size: 40px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; line-height: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 14px rgba(0,0,0,0.55); }
  .gm-o-team.home .gm-o-name { text-align: right; }
  .gm-o-crest { flex: none; width: 58px; height: 58px; border-radius: 999px; object-fit: cover; background: rgba(255,255,255,0.08);
    border: 3px solid var(--gm-team, rgba(255,255,255,0.3)); box-shadow: 0 6px 16px rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; }
  .gm-o-stripe { flex: none; width: 6px; align-self: stretch; margin: 16px 0; border-radius: 999px; background: var(--gm-team, rgba(255,255,255,0.25)); }

  .gm-o-plate { display: flex; align-items: center; gap: 30px; padding: 14px 38px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--gm-accent) 84%, white), color-mix(in srgb, var(--gm-accent) 78%, black));
    color: var(--gm-accent-ink); box-shadow: inset 0 2px 0 rgba(255,255,255,0.40), inset 0 -14px 30px rgba(0,0,0,0.20); }
  .gm-o-num { min-width: 112px; text-align: center; font-size: 76px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums;
    animation: gm-o-pop 280ms cubic-bezier(0.2, 0.9, 0.2, 1); }

  .gm-o-medal { position: relative; flex: none; width: 108px; height: 108px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 36%, #ffffff, #eef2f5 70%, #d9e0e6); border: 3px solid #f8fafc;
    box-shadow: 0 10px 26px rgba(0,0,0,0.45), 0 0 0 7px rgba(6,10,14,0.55), 0 0 0 9px color-mix(in srgb, var(--gm-accent) 34%, transparent); }
  .gm-o-medal::before { content: ""; position: absolute; inset: -12px; border-radius: 999px; z-index: -1; filter: blur(4px);
    background: conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--gm-accent) 58%, transparent) 130deg, transparent 260deg);
    animation: gm-o-spin 11s linear infinite; }
  .gm-o-logo { width: 80%; height: 80%; object-fit: contain; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.28)); }
  .gm-o-mono { font-size: 38px; font-weight: 800; color: #0b0f14; letter-spacing: 1px; }

  .gm-o-overhead { position: absolute; left: 0; right: 0; bottom: 100%; padding-bottom: 10px; display: flex; flex-direction: column-reverse; gap: 10px; }
  .gm-o.top .gm-o-overhead { bottom: auto; top: 100%; padding: 10px 0 0; flex-direction: column; }
  .gm-o-markers { display: flex; justify-content: space-between; gap: 10px; padding: 0 30px; }
  .gm-o-markers-side { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; max-width: 46%; }
  .gm-o-markers-side.home { justify-content: flex-end; margin-left: auto; }
  .gm-o-markers-side.away { justify-content: flex-start; margin-right: auto; }
  .gm-o-marker { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; white-space: nowrap;
    background: rgba(9,12,16,0.88); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 8px 18px rgba(0,0,0,0.4);
    font-size: 17px; font-weight: 800; letter-spacing: 0.3px; animation: gm-o-fade 260ms ease-out both; }
  .gm-o-marker.yellow_card { border-color: rgba(234,179,8,0.6); color: #facc15; }
  .gm-o-marker.red_card { border-color: rgba(239,68,68,0.6); color: #f87171; }
  .gm-o-marker.suspension { border-color: rgba(96,165,250,0.6); color: #93c5fd; }
  .gm-o-marker.boost { border-color: color-mix(in srgb, var(--gm-accent) 60%, transparent); color: var(--gm-accent); }
  .gm-o-marker-text { max-width: 150px; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }

  .gm-o-flash-row { display: flex; justify-content: center; }
  .gm-o-flash { display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-radius: 999px; white-space: nowrap;
    background: linear-gradient(180deg, rgba(15,20,26,0.95), rgba(8,11,15,0.97)); border: 1px solid rgba(255,255,255,0.12); border-top-color: rgba(255,255,255,0.26);
    box-shadow: 0 26px 60px rgba(0,0,0,0.55), 0 8px 22px color-mix(in srgb, var(--gm-accent) 24%, transparent);
    font-size: 30px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; animation: gm-o-flash-in 320ms cubic-bezier(0.2, 0.9, 0.2, 1) both; }
  .gm-o-flash-tag { color: var(--gm-accent); }
  .gm-o-flash-sep { color: rgba(255,255,255,0.35); }

  .gm-o-corner { position: absolute; right: 40px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .gm-o-chip { display: flex; align-items: center; gap: 10px; padding: 7px 14px; border-radius: 10px; background: rgba(10,13,18,0.84);
    border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 8px 20px rgba(0,0,0,0.4); animation: gm-o-fade 500ms ease-out both; }
  .gm-o-dot { flex: none; width: 8px; height: 8px; border-radius: 999px; background: var(--gm-accent); }
  .gm-o-dot.run { animation: gm-o-blink 1s ease-in-out infinite; }
  .gm-o-dot.off { background: #ef4444; }
  .gm-o-time { font-size: 30px; font-weight: 800; letter-spacing: 1px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.95); line-height: 1; }
  .gm-o-label { font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.6); line-height: 1; }
  .gm-o-sets { font-size: 20px; font-weight: 800; letter-spacing: 1px; color: rgba(255,255,255,0.92); font-variant-numeric: tabular-nums; }

  .gm-o-teaser { display: flex; align-items: center; gap: 14px; padding: 16px 32px; border-radius: 999px;
    background: linear-gradient(180deg, rgba(15,20,26,0.92), rgba(8,11,15,0.95)); border: 1px solid rgba(255,255,255,0.09); border-top-color: rgba(255,255,255,0.22);
    box-shadow: 0 24px 60px rgba(0,0,0,0.5), 0 8px 24px color-mix(in srgb, var(--gm-accent) 18%, transparent);
    font-size: 30px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; animation: gm-o-rise 460ms ease-out both; }
  .gm-o-teaser .gm-o-dot { width: 12px; height: 12px; animation: gm-o-blink 1.2s ease-in-out infinite; }
  .gm-o-nosignal { position: absolute; right: 24px; bottom: 16px; display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 8px;
    background: rgba(10,13,18,0.8); font-size: 15px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.7); }

  @keyframes gm-o-pop { from { transform: scale(1.35); } to { transform: scale(1); } }
  @keyframes gm-o-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes gm-o-spin { to { transform: rotate(360deg); } }
  @keyframes gm-o-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes gm-o-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes gm-o-flash-in { from { opacity: 0; transform: translateY(14px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
`;

function teamName(team: LiveSideState): string {
  return team.shortName || team.name;
}

function TeamBlock({ team, side }: { team: LiveSideState; side: MatchSide }) {
  const style = { "--gm-team": team.color ?? undefined } as CSSProperties;
  const crest = team.crestUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- fonte do OBS, imagem já em variante do Blob
    <img className="gm-o-crest" src={team.crestUrl} alt="" style={style} />
  ) : (
    <span className="gm-o-crest" style={style}>
      {monogram(team.name)}
    </span>
  );
  return (
    <div className={`gm-o-team ${side}`} style={style}>
      {side === "away" ? crest : null}
      <span className="gm-o-name">{teamName(team)}</span>
      {side === "home" ? crest : null}
    </div>
  );
}

function Markers({ markers, side }: { markers: LiveMarker[]; side: MatchSide }) {
  return (
    <div className={`gm-o-markers-side ${side}`}>
      {markers
        .filter((marker) => marker.side === side)
        .map((marker) => (
          <span key={marker.id} className={`gm-o-marker ${marker.kind}`}>
            <span aria-hidden="true">{marker.emoji}</span>
            <span className="gm-o-marker-text">{marker.athleteName ?? marker.label}</span>
          </span>
        ))}
    </div>
  );
}

export function Scoreboard({
  initialState,
  accentColor,
  accentInk,
  goalFlashMs,
  logoUrl,
  competitionName,
  position,
}: {
  initialState: LiveMatchState;
  accentColor: string;
  accentInk: string;
  goalFlashMs: number;
  logoUrl: string | null;
  competitionName: string;
  position: OverlayPosition;
}) {
  const { state, online, clockOffsetMs } = useLiveState(initialState, { channelKey: initialState.channelKey });
  // "Agora" no relógio do servidor; 0 até hidratar (servidor e cliente não batem — sem destaque
  // nem tempo corrido no HTML inicial).
  const now = useNow(clockOffsetMs);
  const [logoOk, setLogoOk] = useState(Boolean(logoUrl));
  const vars = accentVars(accentColor, accentInk);

  if (!state.matchId || !state.home || !state.away) {
    return (
      <>
        <style>{CSS}</style>
        <div className={`gm-o ${position}`} style={vars}>
          {state.teaser ? (
            <div className="gm-o-strip">
              <div className="gm-o-teaser">
                <span className="gm-o-dot" />
                {state.teaser}
              </div>
            </div>
          ) : null}
          {!online ? <NoSignal /> : null}
        </div>
      </>
    );
  }

  const profile = getSportProfile(state.sportProfile ?? "pontos");
  const finished = state.status !== "live";
  const elapsed = now === 0 ? state.clock.accumulatedMs : elapsedMs(state.clock, now);
  const showClock = profile.clock.enabled && !finished && (state.clock.running || elapsed > 0);
  const label = finished ? (state.label === "FIM DE JOGO" ? state.label : "ENCERRADO") : state.label;
  const flash = now > 0 && state.lastScore && !finished && now - state.lastScore.occurredAt >= 0 && now - state.lastScore.occurredAt < goalFlashMs ? state.lastScore : null;
  const homeShown = profile.usesSets ? (state.currentSet?.home ?? 0) : state.home.score;
  const awayShown = profile.usesSets ? (state.currentSet?.away ?? 0) : state.away.score;

  return (
    <>
      <style>{CSS}</style>
      <div className={`gm-o ${position}`} style={vars}>
        <div className="gm-o-strip">
          <div className="gm-o-bar">
            <div className="gm-o-overhead">
              <div className="gm-o-markers">
                <Markers markers={state.markers} side="home" />
                <Markers markers={state.markers} side="away" />
              </div>
              {flash ? (
                <div className="gm-o-flash-row">
                  <div className="gm-o-flash" key={flash.occurredAt}>
                    <span className="gm-o-flash-tag">{flash.label}!</span>
                    <span>{teamName(flash.side === "home" ? state.home : state.away)}</span>
                    {flash.athleteName ? (
                      <>
                        <span className="gm-o-flash-sep">·</span>
                        <span>{flash.athleteName}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <TeamBlock team={state.home} side="home" />
            <div className="gm-o-plate">
              <span className="gm-o-num" key={`h-${homeShown}`}>
                {formatScore(homeShown)}
              </span>
              <div className="gm-o-medal" aria-hidden="true">
                {logoOk && logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- fonte do OBS
                  <img className="gm-o-logo" src={logoUrl} alt="" onError={() => setLogoOk(false)} />
                ) : (
                  <span className="gm-o-mono">{monogram(competitionName || "Jogos")}</span>
                )}
              </div>
              <span className="gm-o-num" key={`a-${awayShown}`}>
                {formatScore(awayShown)}
              </span>
            </div>
            <TeamBlock team={state.away} side="away" />
          </div>

          {showClock || label || profile.usesSets || !online ? (
            <div className="gm-o-corner">
              {profile.usesSets ? (
                <div className="gm-o-chip">
                  <span className="gm-o-label">Sets</span>
                  <span className="gm-o-sets">
                    {state.home.score}–{state.away.score}
                  </span>
                </div>
              ) : null}
              {showClock || label || !online ? (
                <div className="gm-o-chip">
                  <span className={`gm-o-dot ${!online ? "off" : state.clock.running ? "run" : ""}`} />
                  {!online ? (
                    <span className="gm-o-label">Sem sinal</span>
                  ) : (
                    <>
                      {showClock ? <span className="gm-o-time">{formatClock(elapsed)}</span> : null}
                      {label ? <span className="gm-o-label">{label}</span> : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function NoSignal() {
  return (
    <div className="gm-o-nosignal">
      <span className="gm-o-dot off" />
      Sem sinal
    </div>
  );
}
