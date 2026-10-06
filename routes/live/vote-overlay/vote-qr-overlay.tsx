"use client";

import { useEffect, useState } from "react";
import type { QrSvg } from "../../../shared/qr";
import { accentVars, LIVE_FONT_FAMILY } from "../live-style";
import type { VoteCallout } from "../vote-board";
import { getVoteCalloutAction } from "./actions";

export type VoteOverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const POLL_MS = 30_000;

// Fonte do OBS (1920×1080, fundo transparente): cartão com QR + chamada. Mesmas regras do overlay
// do placar — CSS próprio, px fixos, cor de destaque por variável.
const CSS = `
  html, body { background: transparent !important; margin: 0; overflow: hidden; }
  .gm-vq { position: fixed; inset: 0; pointer-events: none; font-family: ${LIVE_FONT_FAMILY}; -webkit-font-smoothing: antialiased; }
  .gm-vq-card { position: absolute; display: flex; align-items: center; gap: 26px; width: 600px; padding: 22px 30px 22px 22px; border-radius: 26px; box-sizing: border-box;
    background: linear-gradient(180deg, rgba(15,20,26,0.93), rgba(8,11,15,0.96)); border: 1px solid rgba(255,255,255,0.10); border-top-color: rgba(255,255,255,0.24);
    box-shadow: 0 30px 70px rgba(0,0,0,0.55), 0 8px 24px color-mix(in srgb, var(--gm-accent) 22%, transparent);
    animation: gm-vq-in 420ms cubic-bezier(0.2, 0.9, 0.2, 1) both; }
  .gm-vq-card::after { content: ""; position: absolute; left: 22px; right: 22px; bottom: 0; height: 3px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, var(--gm-accent), transparent); }
  .gm-vq-card.top-left { top: 48px; left: 48px; }
  .gm-vq-card.top-right { top: 48px; right: 48px; }
  .gm-vq-card.bottom-left { bottom: 48px; left: 48px; }
  .gm-vq-card.bottom-right { bottom: 48px; right: 48px; }
  .gm-vq-qr { flex: none; width: 196px; height: 196px; padding: 12px; border-radius: 18px; background: #ffffff; box-sizing: border-box; box-shadow: 0 10px 26px rgba(0,0,0,0.35); }
  .gm-vq-qr svg { display: block; width: 100%; height: 100%; }
  .gm-vq-text { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .gm-vq-eyebrow { color: var(--gm-accent); font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap; }
  .gm-vq-title { color: #fff; font-size: 40px; font-weight: 800; line-height: 1.02; text-transform: uppercase;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .gm-vq-hint { color: rgba(255,255,255,0.8); font-size: 22px; font-weight: 600; }
  .gm-vq-url { color: #fff; font-size: 20px; font-weight: 800; opacity: 0.9; overflow-wrap: anywhere; }
  @keyframes gm-vq-in { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: none; } }
`;

export function VoteQrOverlay({
  initialCallout,
  qr,
  displayUrl,
  accentColor,
  accentInk,
  position,
}: {
  initialCallout: VoteCallout;
  qr: QrSvg;
  displayUrl: string;
  accentColor: string;
  accentInk: string;
  position: VoteOverlayPosition;
}) {
  const [callout, setCallout] = useState(initialCallout);

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      getVoteCalloutAction()
        .then((next) => {
          if (!cancelled) setCallout(next);
        })
        .catch(() => {
          // rede instável — mantém o último estado
        });
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="gm-vq" style={accentVars(accentColor, accentInk)}>
        {callout ? (
          <div key={callout.pollId} className={`gm-vq-card ${position}`}>
            <div className="gm-vq-qr">
              <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label="QR code da votação">
                <path d={qr.path} fill="#000000" />
              </svg>
            </div>
            <div className="gm-vq-text">
              <span className="gm-vq-eyebrow">{callout.kind === "match" ? "Vote no craque da torcida" : "Vote na equipe favorita"}</span>
              <span className="gm-vq-title">{callout.title}</span>
              <span className="gm-vq-hint">Aponte a câmera do celular</span>
              <span className="gm-vq-url">{displayUrl}</span>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
