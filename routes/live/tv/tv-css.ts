import { LIVE_FONT_FAMILY } from "../live-style";

// CSS da TV (palco de 1920px escalado — tamanhos em px do palco, não da tela). Fora do tema.
export const TV_CSS = `
  html, body { margin: 0; background: #0a0d12; overflow: hidden; }
  .gm-tv-viewport, .gm-tv-viewport * { box-sizing: border-box; }
  .gm-tv-viewport { position: fixed; inset: 0; overflow: hidden; background: #0a0d12; }
  .gm-tv { position: absolute; top: 0; left: 0; transform-origin: top left; display: flex; flex-direction: column;
    font-family: ${LIVE_FONT_FAMILY}; color: #fff; -webkit-font-smoothing: antialiased;
    background: radial-gradient(120% 140% at 50% -10%, #17202b 0%, #0a0d12 55%); }

  .gm-tv-head { display: flex; align-items: center; justify-content: space-between; gap: 40px; padding: 44px 72px 0; }
  .gm-tv-eyebrow { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
  .gm-tv-title { margin: 6px 0 0; font-size: 72px; font-weight: 800; line-height: 1; text-transform: uppercase; letter-spacing: 1px; }
  .gm-tv-subtitle { margin: 12px 0 0; font-size: 30px; font-weight: 600; color: rgba(255,255,255,0.7); }
  .gm-tv-title-bar { width: 96px; height: 7px; border-radius: 999px; background: var(--gm-accent); margin-top: 16px; }
  .gm-tv-logo { height: 120px; max-width: 420px; width: auto; object-fit: contain; }

  .gm-tv-body { flex: 1; min-height: 0; padding: 28px 72px 24px; display: flex; flex-direction: column; justify-content: center; }
  .gm-tv-empty { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 44px; font-weight: 600; color: rgba(255,255,255,0.45); }

  .gm-tv-crest { flex: none; width: 64px; height: 64px; border-radius: 999px; object-fit: cover; background: rgba(255,255,255,0.08);
    border: 4px solid var(--gm-team, rgba(255,255,255,0.18)); display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 800; color: #fff; }

  /* tabelas */
  .gm-tv-card { background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 30px; overflow: hidden; box-shadow: 0 40px 80px -30px rgba(0,0,0,0.65); }
  .gm-tv-table { width: 100%; border-collapse: collapse; }
  .gm-tv-table th { text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.45);
    padding: 18px 20px; border-bottom: 2px solid rgba(255,255,255,0.1); }
  .gm-tv-table th.l, .gm-tv-table td.l { text-align: left; }
  .gm-tv-table td { text-align: center; font-size: 42px; font-weight: 700; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
    font-variant-numeric: tabular-nums; }
  .gm-tv-table.dense td { font-size: 34px; padding: 9px 20px; }
  .gm-tv-table.dense .gm-tv-crest { width: 52px; height: 52px; font-size: 20px; }
  .gm-tv-table tr:last-child td { border-bottom: 0; }
  .gm-tv-table tr.lead td { background: color-mix(in srgb, var(--gm-accent) 14%, transparent); }
  .gm-tv-table td.pos { width: 90px; color: rgba(255,255,255,0.5); }
  .gm-tv-table td.pts { color: var(--gm-accent); font-weight: 800; font-size: 48px; }
  .gm-tv-table.dense td.pts { font-size: 40px; }
  .gm-tv-team { display: flex; align-items: center; gap: 22px; min-width: 0; }
  .gm-tv-team-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gm-tv-team-sub { display: block; font-size: 24px; font-weight: 600; color: rgba(255,255,255,0.5); }
  .gm-tv-medals { white-space: nowrap; font-size: 32px; }

  /* próximos jogos */
  .gm-tv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
  .gm-tv-fixture { display: flex; flex-direction: column; gap: 14px; padding: 24px 30px; border-radius: 26px;
    background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.12); }
  .gm-tv-fixture-meta { display: flex; justify-content: space-between; gap: 20px; font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.6); }
  .gm-tv-fixture-meta strong { color: var(--gm-accent); text-transform: uppercase; letter-spacing: 1px; }
  .gm-tv-fixture-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; }
  .gm-tv-fixture-side { display: flex; align-items: center; gap: 16px; min-width: 0; font-size: 38px; font-weight: 800; text-transform: uppercase; }
  .gm-tv-fixture-side.away { flex-direction: row-reverse; text-align: right; }
  .gm-tv-vs { font-size: 32px; font-weight: 700; font-style: italic; color: rgba(255,255,255,0.4); }
  .gm-tv-fixture.single { padding: 48px 56px; }
  .gm-tv-fixture.single .gm-tv-fixture-side { font-size: 64px; flex-direction: column; gap: 22px; text-align: center; }
  .gm-tv-fixture.single .gm-tv-crest { width: 220px; height: 220px; font-size: 72px; border-width: 8px; }
  .gm-tv-fixture.single .gm-tv-vs { font-size: 72px; }
  .gm-tv-fixture.single .gm-tv-fixture-meta { font-size: 32px; justify-content: center; gap: 40px; }

  /* mata-mata */
  .gm-tv-bracket { flex: 1; min-height: 0; display: flex; gap: 28px; }
  .gm-tv-round { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .gm-tv-round-title { margin: 0; text-align: center; font-size: 26px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
  .gm-tv-round-list { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 14px; }
  .gm-tv-bm { border-radius: 18px; padding: 10px 18px; background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.1); }
  .gm-tv-bm.live { border-color: #ef4444; }
  .gm-tv-bm-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 28px; font-weight: 700; }
  .gm-tv-bm-row + .gm-tv-bm-row { border-top: 1px solid rgba(255,255,255,0.08); }
  .gm-tv-bm-row.won { color: var(--gm-accent); font-weight: 800; }
  .gm-tv-bm-row .gm-tv-crest { width: 40px; height: 40px; border-width: 3px; font-size: 15px; }
  .gm-tv-bm-score { margin-left: auto; font-variant-numeric: tabular-nums; }
  .gm-tv-bm-when { font-size: 18px; color: rgba(255,255,255,0.45); text-align: center; padding-top: 4px; }

  /* ao vivo */
  .gm-tv-live { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 30px; }
  .gm-tv-live-badges { display: flex; justify-content: center; gap: 14px; }
  .gm-tv-badge { padding: 8px 22px; border-radius: 999px; font-size: 26px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
    background: rgba(255,255,255,0.1); }
  .gm-tv-badge.red { background: #dc2626; display: inline-flex; align-items: center; gap: 12px; }
  .gm-tv-badge.red::before { content: ""; width: 14px; height: 14px; border-radius: 999px; background: #fff; animation: gm-tv-blink 1.2s ease-in-out infinite; }
  .gm-tv-live-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 40px; }
  .gm-tv-live-side { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 0; }
  .gm-tv-live-side .gm-tv-crest { width: 250px; height: 250px; border-width: 9px; font-size: 84px; }
  .gm-tv-live-name { max-width: 100%; font-size: 62px; font-weight: 800; text-transform: uppercase; text-align: center; line-height: 1.05;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gm-tv-live-score { display: flex; align-items: center; gap: 36px; font-size: 230px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
  .gm-tv-live-score .sep { font-size: 120px; color: rgba(255,255,255,0.35); }
  .gm-tv-live-info { display: flex; justify-content: center; align-items: center; gap: 24px; font-size: 40px; font-weight: 700; }
  .gm-tv-live-clock { font-size: 64px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--gm-accent); }
  .gm-tv-live-markers { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; min-height: 48px; }
  .gm-tv-marker { padding: 6px 16px; border-radius: 999px; font-size: 24px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); }
  .gm-tv-flash { align-self: center; padding: 14px 40px; border-radius: 999px; font-size: 48px; font-weight: 800; text-transform: uppercase;
    background: var(--gm-accent); color: var(--gm-accent-ink); animation: gm-tv-pop 360ms cubic-bezier(0.2, 0.9, 0.2, 1) both; }

  .gm-tv-foot { padding: 0 72px 40px; }
  .gm-tv-bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.1); overflow: hidden; }
  .gm-tv-bar-fill { height: 100%; border-radius: 999px; background: var(--gm-accent); }
  .gm-tv-dots { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }
  .gm-tv-dot { width: 12px; height: 12px; border-radius: 999px; background: rgba(255,255,255,0.25); }
  .gm-tv-dot.on { background: #fff; }

  @keyframes gm-tv-progress { from { width: 0%; } to { width: 100%; } }
  @keyframes gm-tv-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes gm-tv-pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
  @keyframes gm-tv-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  .gm-tv-anim { animation: gm-tv-fade 420ms ease-out both; }
`;
