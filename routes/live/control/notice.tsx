import Link from "next/link";
import { accentVars, LIVE_UI_FONT_FAMILY } from "../live-style";

// Aviso de tela cheia do controle (sem login, sem permissão, sem competição/canal). Fora do tema
// do site: CSS próprio, igual ao console.
const CSS = `
  html, body { margin: 0; background: #0b0f14; }
  .gm-cn-wrap { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;
    font-family: ${LIVE_UI_FONT_FAMILY}; box-sizing: border-box;
    background: radial-gradient(120% 140% at 50% -10%, #17202b 0%, #0b0f14 55%); }
  .gm-cn-card { width: 100%; max-width: 380px; padding: 28px 22px; border-radius: 20px; text-align: center; box-sizing: border-box;
    background: linear-gradient(180deg, #171f29, #121821); border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 16px 34px -18px rgba(0,0,0,0.65); }
  .gm-cn-eyebrow { margin: 0 0 6px; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.45); }
  .gm-cn-title { margin: 0 0 10px; font-size: 20px; font-weight: 800; color: #fff; }
  .gm-cn-message { margin: 0 0 22px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,0.65); }
  .gm-cn-links { display: flex; flex-direction: column; gap: 10px; }
  .gm-cn-btn { display: flex; align-items: center; justify-content: center; min-height: 52px; border-radius: 14px; text-decoration: none;
    background: var(--gm-accent); color: var(--gm-accent-ink); font-size: 16px; font-weight: 800; }
  .gm-cn-btn.ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
`;

export type NoticeLink = { href: string; label: string; ghost?: boolean };

export function ControlNotice({ title, message, links, accentColor, accentInk }: { title: string; message: string; links: NoticeLink[]; accentColor: string; accentInk: string }) {
  return (
    <>
      <style>{CSS}</style>
      <main className="gm-cn-wrap" style={accentVars(accentColor, accentInk)}>
        <div className="gm-cn-card">
          <p className="gm-cn-eyebrow">Controle ao vivo</p>
          <h1 className="gm-cn-title">{title}</h1>
          <p className="gm-cn-message">{message}</p>
          <div className="gm-cn-links">
            {links.map((link) => (
              <Link key={link.href} className={`gm-cn-btn ${link.ghost ? "ghost" : ""}`} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
