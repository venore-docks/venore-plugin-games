"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { LiveMatchState, LiveSideState } from "../../../contracts/types";
import { elapsedMs, formatClock } from "../../../shared/clock";
import { formatScore } from "../../../shared/score";
import { getSportProfile } from "../../../shared/sport-profiles";
import { useLiveState, useNow } from "../../../shared/use-live-state";
import { Crest } from "../crest";
import { accentVars } from "../live-style";
import { useTvStage } from "../use-tv-stage";
import { getTvVersionAction } from "./actions";
import { TV_CSS } from "./tv-css";
import type { TvMatchCard, TvPage, TvPageKind, TvTeam } from "./tv-pages";

const PAGE_MS = 12_000;
const VERSION_POLL_MS = 30_000;
const LIVE_POLL_MS = 3_000;

type LiveView = { state: LiveMatchState; offsetMs: number };
type Props = {
  pages: TvPage[];
  version: string | null;
  pin: TvPageKind[] | null;
  initialLive: LiveMatchState | null;
  competitionName: string;
  logoUrl: string | null;
  accentColor: string;
  accentInk: string;
  goalFlashMs: number;
};

// Com canal: acompanha o estado ao vivo por polling (JSON com cache curto na CDN — a TV não
// precisa de SSE e várias TVs não abrem uma conexão longa cada).
export function TvScreen(props: Props) {
  return props.initialLive ? <TvWithLive {...props} initialLive={props.initialLive} /> : <TvCanvas {...props} live={null} />;
}

function TvWithLive(props: Props & { initialLive: LiveMatchState }) {
  const { state, clockOffsetMs } = useLiveState(props.initialLive, { channelKey: props.initialLive.channelKey, mode: "poll", pollMs: LIVE_POLL_MS });
  const live = state.matchId && state.status === "live" && state.home && state.away ? { state, offsetMs: clockOffsetMs } : null;
  return <TvCanvas {...props} live={live} />;
}

type Slide = { key: string; kind: TvPageKind; title: string; subtitle: string | null; page: TvPage | null };

function TvCanvas({ pages, version, pin, competitionName, logoUrl, accentColor, accentInk, goalFlashMs, live }: Props & { live: LiveView | null }) {
  const router = useRouter();
  const stage = useTvStage();

  // Dados novos: compara a versão a cada 30s e só então pede a página de novo ao servidor.
  useEffect(() => {
    const timer = setInterval(() => {
      getTvVersionAction()
        .then((current) => {
          if (current !== version) router.refresh();
        })
        .catch(() => {
          // rede instável — próximo ciclo tenta de novo
        });
    }, VERSION_POLL_MS);
    return () => clearInterval(timer);
  }, [version, router]);

  const slides: Slide[] = [];
  if (live) {
    slides.push({ key: "live", kind: "live", title: "Ao vivo", subtitle: [live.state.modalityName, live.state.stageLabel].filter(Boolean).join(" · ") || null, page: null });
  }
  for (const page of pages) slides.push({ key: page.key, kind: page.kind, title: page.title, subtitle: page.subtitle, page });
  const visible = pin ? slides.filter((slide) => pin.includes(slide.kind)) : slides;

  const [index, setIndex] = useState(0);
  const safeIndex = visible.length === 0 ? 0 : index % visible.length;
  const current = visible[safeIndex] ?? null;

  useEffect(() => {
    if (visible.length <= 1) return;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % visible.length), PAGE_MS);
    return () => clearTimeout(timer);
  }, [safeIndex, visible.length]);

  return (
    <>
      <style>{TV_CSS}</style>
      <div className="gm-tv-viewport" style={accentVars(accentColor, accentInk)}>
        <div className="gm-tv" style={{ width: stage.stageWidthPx, height: stage.stageHeightPx, transform: `scale(${stage.scale})` }}>
          <header className="gm-tv-head">
            <div>
              <p className="gm-tv-eyebrow">{competitionName}</p>
              <h1 className="gm-tv-title">{current?.title ?? "Jogos"}</h1>
              {current?.subtitle ? <p className="gm-tv-subtitle">{current.subtitle}</p> : null}
              <div className="gm-tv-title-bar" />
            </div>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- tela standalone (TV)
              <img className="gm-tv-logo" src={logoUrl} alt="" />
            ) : null}
          </header>

          <main className="gm-tv-body">
            {!current ? (
              <p className="gm-tv-empty">{pin?.includes("live") ? "Nenhum jogo ao vivo agora." : "Nada para mostrar ainda — as tabelas aparecem quando os jogos forem cadastrados."}</p>
            ) : (
              <div key={current.key} className="gm-tv-anim" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {current.kind === "live" && live ? <LivePage live={live} flashMs={goalFlashMs} /> : current.page ? <PageBody page={current.page} /> : null}
              </div>
            )}
          </main>

          {visible.length > 1 ? (
            <footer className="gm-tv-foot">
              <div className="gm-tv-bar">
                <div key={`${safeIndex}:${current?.key}`} className="gm-tv-bar-fill" style={{ animation: `gm-tv-progress ${PAGE_MS}ms linear forwards` }} />
              </div>
              <div className="gm-tv-dots">
                {visible.map((slide, slideIndex) => (
                  <span key={slide.key} className={`gm-tv-dot ${slideIndex === safeIndex ? "on" : ""}`} />
                ))}
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </>
  );
}

function teamStyle(team: { color: string | null }): CSSProperties {
  return { "--gm-team": team.color ?? undefined } as CSSProperties;
}

function TeamCrest({ team }: { team: TvTeam | LiveSideState }) {
  return <Crest url={team.crestUrl} name={team.name} className="gm-tv-crest" style={teamStyle(team)} />;
}

function PageBody({ page }: { page: TvPage }) {
  switch (page.kind) {
    case "upcoming":
      return <UpcomingPage matches={page.matches} />;
    case "standings":
      return (
        <div className="gm-tv-card">
          <table className={`gm-tv-table ${page.rows.length > 8 ? "dense" : ""}`}>
            <thead>
              <tr>
                <th />
                <th className="l">Equipe</th>
                <th>J</th>
                <th>V</th>
                <th>E</th>
                <th>D</th>
                <th>{page.diffLabel}</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.team.name + row.position} className={row.position === 1 ? "lead" : undefined}>
                  <td className="pos">{row.position}º</td>
                  <td className="l">
                    <div className="gm-tv-team">
                      <TeamCrest team={row.team} />
                      <span className="gm-tv-team-name">{row.team.name}</span>
                    </div>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.drawn}</td>
                  <td>{row.lost}</td>
                  <td>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                  <td className="pts">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "results":
      return (
        <div className="gm-tv-card">
          <table className={`gm-tv-table ${page.rows.length > 8 ? "dense" : ""}`}>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.team.name + row.position} className={row.position === 1 ? "lead" : undefined}>
                  <td className="pos">{row.position}º</td>
                  <td className="l">
                    <div className="gm-tv-team">
                      <TeamCrest team={row.team} />
                      <span className="gm-tv-team-name">{row.team.name}</span>
                    </div>
                  </td>
                  <td className="pts">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "bracket":
      return (
        <div className="gm-tv-bracket">
          {page.rounds.map((round) => (
            <section key={round.label} className="gm-tv-round">
              <h2 className="gm-tv-round-title">{round.label}</h2>
              <div className="gm-tv-round-list">
                {round.matches.map((match) => (
                  <BracketMatch key={match.id} match={match} />
                ))}
              </div>
            </section>
          ))}
        </div>
      );
    case "scorers":
      return (
        <div className="gm-tv-card">
          <table className="gm-tv-table">
            <thead>
              <tr>
                <th />
                <th className="l">Atleta</th>
                <th>{page.valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.name + row.position} className={row.position === 1 ? "lead" : undefined}>
                  <td className="pos">{row.position}º</td>
                  <td className="l">
                    <div className="gm-tv-team">
                      <Crest url={row.photoUrl} name={row.name} className="gm-tv-crest" style={teamStyle(row.team ?? { color: null })} />
                      <span className="gm-tv-team-name">
                        {row.name}
                        {row.team ? <span className="gm-tv-team-sub">{row.team.name}</span> : null}
                      </span>
                    </div>
                  </td>
                  <td className="pts">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "overall":
      return (
        <div className="gm-tv-card">
          <table className={`gm-tv-table ${page.rows.length > 8 ? "dense" : ""}`}>
            <thead>
              <tr>
                <th />
                <th className="l">Equipe</th>
                {page.columns.map((column) => (
                  <th key={column.label} title={column.label}>
                    {column.emoji ?? column.label.slice(0, 3)}
                  </th>
                ))}
                <th>Medalhas</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.team.name + row.position} className={row.position === 1 ? "lead" : undefined}>
                  <td className="pos">{row.position}º</td>
                  <td className="l">
                    <div className="gm-tv-team">
                      <TeamCrest team={row.team} />
                      <span className="gm-tv-team-name">{row.team.shortName || row.team.name}</span>
                    </div>
                  </td>
                  {row.byModality.map((value, columnIndex) => (
                    <td key={columnIndex}>{value}</td>
                  ))}
                  <td className="gm-tv-medals">
                    {row.golds > 0 || row.silvers > 0 || row.bronzes > 0 ? `🥇${row.golds} 🥈${row.silvers} 🥉${row.bronzes}` : "–"}
                  </td>
                  <td className="pts">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function UpcomingPage({ matches }: { matches: TvMatchCard[] }) {
  if (matches.length === 1) return <FixtureCard match={matches[0]} single />;
  return (
    <div className="gm-tv-grid">
      {matches.map((match) => (
        <FixtureCard key={match.id} match={match} />
      ))}
    </div>
  );
}

function FixtureCard({ match, single = false }: { match: TvMatchCard; single?: boolean }) {
  return (
    <article className={`gm-tv-fixture ${single ? "single" : ""}`}>
      <div className="gm-tv-fixture-meta">
        <strong>{[match.emoji, match.modality].filter(Boolean).join(" ")}</strong>
        <span>{[match.round, match.when, match.venue].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="gm-tv-fixture-teams">
        <div className="gm-tv-fixture-side">
          <TeamCrest team={match.home} />
          <span className="gm-tv-team-name">{match.home.shortName || match.home.name}</span>
        </div>
        <span className="gm-tv-vs">×</span>
        <div className="gm-tv-fixture-side away">
          <TeamCrest team={match.away} />
          <span className="gm-tv-team-name">{match.away.shortName || match.away.name}</span>
        </div>
      </div>
    </article>
  );
}

function BracketMatch({ match }: { match: TvMatchCard }) {
  const played = match.status === "finished" || match.status === "live";
  return (
    <div className={`gm-tv-bm ${match.status === "live" ? "live" : ""}`}>
      {(["home", "away"] as const).map((side) => {
        const team = match[side];
        return (
          <div key={side} className={`gm-tv-bm-row ${match.winner === side ? "won" : ""}`}>
            <TeamCrest team={team} />
            <span className="gm-tv-team-name">{team.shortName || team.name}</span>
            {played ? <span className="gm-tv-bm-score">{side === "home" ? match.homeScore : match.awayScore}</span> : null}
          </div>
        );
      })}
      {!played ? <div className="gm-tv-bm-when">{match.when}</div> : null}
    </div>
  );
}

function LivePage({ live, flashMs }: { live: LiveView; flashMs: number }) {
  const { state } = live;
  const now = useNow(live.offsetMs);
  const profile = getSportProfile(state.sportProfile ?? "pontos");
  const home = state.home!;
  const away = state.away!;
  const elapsed = now === 0 ? state.clock.accumulatedMs : elapsedMs(state.clock, now);
  const showClock = profile.clock.enabled && (state.clock.running || elapsed > 0);
  const flash = now > 0 && state.lastScore && now - state.lastScore.occurredAt >= 0 && now - state.lastScore.occurredAt < flashMs ? state.lastScore : null;

  return (
    <div className="gm-tv-live">
      <div className="gm-tv-live-badges">
        <span className="gm-tv-badge red">Ao vivo</span>
        <span className="gm-tv-badge">{state.channelName}</span>
      </div>
      <div className="gm-tv-live-row">
        {[home, away].map((team, index) => (
          <div key={index} className="gm-tv-live-side" style={{ gridColumn: index === 0 ? 1 : 3, gridRow: 1 }}>
            <TeamCrest team={team} />
            <span className="gm-tv-live-name">{team.shortName || team.name}</span>
            <div className="gm-tv-live-markers">
              {state.markers
                .filter((marker) => marker.side === (index === 0 ? "home" : "away"))
                .map((marker) => (
                  <span key={marker.id} className="gm-tv-marker">
                    {marker.emoji} {marker.athleteName ?? marker.label}
                  </span>
                ))}
            </div>
          </div>
        ))}
        <div className="gm-tv-live-score" style={{ gridColumn: 2, gridRow: 1 }}>
          <span>{formatScore(home.score)}</span>
          <span className="sep">×</span>
          <span>{formatScore(away.score)}</span>
        </div>
      </div>
      <div className="gm-tv-live-info">
        {showClock ? <span className="gm-tv-live-clock">{formatClock(elapsed)}</span> : null}
        {state.label ? <span>{state.label}</span> : null}
        {profile.usesSets && state.currentSet ? (
          <span>
            Set atual {state.currentSet.home}–{state.currentSet.away}
          </span>
        ) : null}
      </div>
      {flash ? (
        <div key={flash.occurredAt} className="gm-tv-flash">
          {flash.label}! {(flash.side === "home" ? home : away).shortName || (flash.side === "home" ? home : away).name}
          {flash.athleteName ? ` · ${flash.athleteName}` : ""}
        </div>
      ) : null}
    </div>
  );
}
