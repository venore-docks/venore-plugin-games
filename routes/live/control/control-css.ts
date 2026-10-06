import { LIVE_UI_FONT_FAMILY } from "../live-style";

// CSS do console de controle (fora do tema do site — as variáveis shadcn não existem em /ext).
// Mobile-first de verdade: tudo cabe em 360px, alvos de toque ≥ 44px, ações principais ≥ 56px.
// A partir de 720px o console centraliza e ganha respiro; nada depende de hover.
export const CONTROL_CSS = `
  html, body { margin: 0; background: #0b0f14; }
  .gm-c, .gm-c * { box-sizing: border-box; }
  .gm-c {
    min-height: 100dvh; padding: 12px 12px calc(28px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px;
    font-family: ${LIVE_UI_FONT_FAMILY}; color: #fff; -webkit-tap-highlight-color: transparent;
    background: radial-gradient(120% 60% at 50% -10%, #17202b 0%, #0b0f14 70%);
  }
  .gm-c button { font-family: inherit; touch-action: manipulation; }
  .gm-c button:disabled { opacity: 0.45; cursor: default; }
  .gm-c :focus-visible { outline: 2px solid var(--gm-accent); outline-offset: 2px; }
  .gm-c-inner { width: 100%; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }

  .gm-c-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .gm-c-title { margin: 0; min-width: 0; }
  .gm-c-eyebrow { display: block; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(255,255,255,0.45);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-c-channel { display: block; font-size: 18px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-c-conn { flex: none; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.65); }
  .gm-c-dot { width: 9px; height: 9px; border-radius: 999px; background: var(--gm-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gm-accent) 25%, transparent); }
  .gm-c-dot.off { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.25); animation: gm-c-blink 1s ease-in-out infinite; }

  .gm-c-channels { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .gm-c-channels::-webkit-scrollbar { display: none; }
  .gm-c-channel-chip { flex: none; display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border-radius: 999px; text-decoration: none;
    font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.03); }
  .gm-c-channel-chip.on { background: var(--gm-accent); color: var(--gm-accent-ink); border-color: transparent; }

  .gm-c-card { background: linear-gradient(180deg, #171f29, #121821); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px;
    box-shadow: 0 16px 34px -18px rgba(0,0,0,0.65); padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .gm-c-card-title { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
  .gm-c-hint { margin: 0; font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.55); }

  .gm-c-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; padding: 0 16px; border-radius: 14px;
    font-size: 15px; font-weight: 800; cursor: pointer; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.04); color: #fff;
    text-decoration: none; transition: transform 120ms ease; }
  .gm-c-btn:active:not(:disabled) { transform: scale(0.97); }
  .gm-c-btn.primary { background: var(--gm-accent); color: var(--gm-accent-ink); border-color: transparent;
    box-shadow: 0 12px 24px -12px color-mix(in srgb, var(--gm-accent) 60%, transparent); }
  .gm-c-btn.warn { background: #eab308; color: #1a1300; border-color: transparent; }
  .gm-c-btn.danger { background: rgba(248,113,113,0.12); color: #fca5a5; border-color: rgba(248,113,113,0.45); }
  .gm-c-btn.block { width: 100%; }
  .gm-c-btn.big { min-height: 60px; font-size: 18px; }
  .gm-c-btn.small { min-height: 40px; padding: 0 12px; font-size: 13px; border-radius: 12px; }
  .gm-c-link { background: none; border: 0; padding: 10px; color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .gm-c-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .gm-c-row > * { flex: 1 1 0; }

  .gm-c-input, .gm-c-select { width: 100%; min-height: 48px; padding: 0 12px; font-size: 16px; color: #fff; background: #0f151c;
    border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; outline: none; font-family: inherit; }
  .gm-c-input:focus, .gm-c-select:focus { border-color: var(--gm-accent); }
  .gm-c-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); }

  /* relógio */
  .gm-c-clock { align-items: center; text-align: center; }
  .gm-c-time { font-size: 56px; font-weight: 900; line-height: 1; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
  .gm-c-time.run { color: var(--gm-accent); text-shadow: 0 0 26px color-mix(in srgb, var(--gm-accent) 45%, transparent); }
  .gm-c-period { font-size: 12px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,0.5); }
  .gm-c-clock .gm-c-row { width: 100%; }

  /* etiqueta */
  .gm-c-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .gm-c-chip { min-height: 40px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 0.6px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.03); color: #fff; }
  .gm-c-chip.on { background: color-mix(in srgb, var(--gm-accent) 22%, transparent); border-color: var(--gm-accent); color: #fff; }

  /* placar */
  .gm-c-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .gm-c-side { padding: 12px 10px; gap: 10px; align-items: stretch; border-top: 4px solid var(--gm-team, rgba(255,255,255,0.2)); }
  .gm-c-side-name { font-size: 14px; font-weight: 800; text-transform: uppercase; text-align: center; letter-spacing: 0.4px; color: rgba(255,255,255,0.88);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-c-score { font-size: 64px; font-weight: 900; line-height: 1; text-align: center; font-variant-numeric: tabular-nums; }
  .gm-c-sets { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.6); }
  .gm-c-sets strong { color: var(--gm-accent); font-size: 18px; }
  .gm-c-plus { width: 100%; min-height: 64px; border: 0; border-radius: 14px; font-size: 22px; font-weight: 900; cursor: pointer;
    background: var(--gm-accent); color: var(--gm-accent-ink); box-shadow: 0 12px 24px -12px color-mix(in srgb, var(--gm-accent) 60%, transparent);
    transition: transform 120ms ease; }
  .gm-c-plus:active:not(:disabled) { transform: scale(0.97); }
  .gm-c-plus.alt { min-height: 48px; font-size: 17px; background: transparent; color: var(--gm-accent);
    border: 1px solid color-mix(in srgb, var(--gm-accent) 55%, transparent); box-shadow: none; }
  .gm-c-kinds { display: grid; grid-template-columns: 1fr; gap: 6px; }
  .gm-c-kind { min-height: 44px; padding: 0 6px; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.85);
    display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; overflow: hidden; }
  .gm-c-sub { font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.4); margin: 4px 0 -4px; }
  .gm-c-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .gm-c-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; max-width: 100%; padding: 0 6px 0 10px; border-radius: 999px; cursor: pointer;
    border: 0; background: color-mix(in srgb, var(--gm-accent) 18%, transparent); color: #fff; font-size: 12px; font-weight: 800; }
  .gm-c-pill span.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gm-c-pill .x { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 22px; height: 22px; border-radius: 999px;
    background: rgba(0,0,0,0.3); font-size: 14px; line-height: 1; }

  /* lances */
  .gm-c-events { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .gm-c-event { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .gm-c-event:last-child { border-bottom: 0; }
  .gm-c-event-emoji { flex: none; width: 28px; text-align: center; font-size: 18px; }
  .gm-c-event-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .gm-c-event-title { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-c-event-meta { font-size: 12px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gm-c-event-who { flex: none; min-height: 40px; padding: 0 10px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer;
    background: color-mix(in srgb, var(--gm-accent) 16%, transparent); color: #fff; border: 1px dashed color-mix(in srgb, var(--gm-accent) 60%, transparent); }
  .gm-c-event-x { flex: none; width: 40px; height: 40px; border-radius: 10px; font-size: 18px; cursor: pointer; border: 1px solid rgba(255,255,255,0.14);
    background: transparent; color: rgba(255,255,255,0.7); }

  /* escolher jogo */
  .gm-c-group { display: flex; flex-direction: column; gap: 8px; }
  .gm-c-group-title { margin: 6px 0 0; font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.7); }
  .gm-c-match { display: flex; flex-direction: column; align-items: stretch; gap: 3px; width: 100%; min-height: 60px; padding: 10px 14px; border-radius: 14px;
    text-align: left; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); color: #fff; }
  .gm-c-match:active:not(:disabled) { background: rgba(255,255,255,0.08); }
  .gm-c-match-teams { font-size: 16px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gm-c-match-meta { font-size: 12px; color: rgba(255,255,255,0.55); }
  .gm-c-badge { display: inline-block; margin-right: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: 0.8px;
    background: #ef4444; color: #fff; vertical-align: 1px; }

  /* placar final */
  .gm-c-final { text-align: center; align-items: center; }
  .gm-c-final-score { display: flex; align-items: center; justify-content: center; gap: 14px; width: 100%; }
  .gm-c-final-team { flex: 1; min-width: 0; font-size: 15px; font-weight: 800; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gm-c-final-num { font-size: 44px; font-weight: 900; font-variant-numeric: tabular-nums; }

  .gm-c-foot { margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; overflow-wrap: anywhere; }

  /* folha inferior */
  .gm-c-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,0.6); animation: gm-c-fade 160ms ease-out both; }
  .gm-c-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; max-width: 760px; margin: 0 auto; max-height: 88dvh; overflow-y: auto;
    padding: 16px 14px calc(16px + env(safe-area-inset-bottom)); border-radius: 20px 20px 0 0; display: flex; flex-direction: column; gap: 12px;
    background: linear-gradient(180deg, #1a222d, #10151c); border-top: 1px solid rgba(255,255,255,0.1); box-shadow: 0 -20px 50px rgba(0,0,0,0.5);
    animation: gm-c-rise 200ms ease-out both; font-family: ${LIVE_UI_FONT_FAMILY}; color: #fff; }
  .gm-c-sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .gm-c-sheet-title { margin: 0; font-size: 17px; font-weight: 800; line-height: 1.3; }
  .gm-c-sheet-text { margin: 0; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.7); }
  .gm-c-people { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .gm-c-person { display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 96px; padding: 10px 4px; border-radius: 14px; cursor: pointer;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #fff; }
  .gm-c-person.on { background: color-mix(in srgb, var(--gm-accent) 22%, transparent); border-color: var(--gm-accent); }
  .gm-c-avatar { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; background: rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #fff; }
  .gm-c-person-name { font-size: 12px; font-weight: 700; text-align: center; line-height: 1.2; overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .gm-c-winner { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  /* aviso */
  .gm-c-toast { position: fixed; left: 12px; right: 12px; top: calc(12px + env(safe-area-inset-top)); z-index: 60; max-width: 520px; margin: 0 auto;
    padding: 12px 14px; border-radius: 14px; font-size: 14px; font-weight: 700; line-height: 1.4; animation: gm-c-drop 180ms ease-out both;
    background: #2a1416; color: #fecaca; border: 1px solid rgba(248,113,113,0.5); box-shadow: 0 16px 34px -12px rgba(0,0,0,0.7); }
  .gm-c-toast.ok { background: #10241a; color: #bbf7d0; border-color: color-mix(in srgb, var(--gm-accent) 60%, transparent); }

  @keyframes gm-c-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes gm-c-rise { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes gm-c-drop { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes gm-c-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

  @media (min-width: 480px) {
    .gm-c-kinds { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 720px) {
    .gm-c { padding: 24px 24px 40px; }
    .gm-c-sides { gap: 14px; }
    .gm-c-side { padding: 16px 14px; }
    .gm-c-score { font-size: 84px; }
    .gm-c-people { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
`;
