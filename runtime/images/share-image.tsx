import { COVER_HEIGHT, COVER_WIDTH, STORY_HEIGHT, STORY_WIDTH, fitFontSize, readableTextOn, withAlpha } from "../../shared/image-layout";
import { encodeForWeb, fetchImage, loadSharp, prepareEmblem, preparePhoto, renderPng, type RenderedImage } from "./og-image";

// Imagens de compartilhamento de um jogo, geradas UMA vez (runtime/share-images.ts) e salvas no
// sistema de mídia — ninguém gera imagem por visita:
// - capa 1280×720 SEM placar: miniatura do YouTube e preview do link no WhatsApp (og:image);
// - story 1080×1920: mesma identidade em 9:16 (status do WhatsApp / story do Instagram); com placar
//   quando o jogo já terminou.
// Fora do tema do site (vão pra fora dele): fundo escuro + cor de destaque da competição.

export type ShareSide = { name: string; crestUrl: string | null; color: string | null };

export type ShareImageData = {
  competitionName: string;
  modalityName: string;
  stageLabel: string | null;
  dateLabel: string;
  accentColor: string;
  logoUrl: string | null;
  photoUrl: string | null;
  home: ShareSide;
  away: ShareSide;
  // Só no story, com o jogo encerrado.
  score: { home: string; away: string } | null;
  domain: string;
};

const BACKGROUND = "#0b0f14";
const FALLBACK_COLOR = "#64748b";

type Prepared = { photo: string | null; homeCrest: string | null; awayCrest: string | null; logo: string | null };

function Emblem({ src, name, size, ring, color }: { src: string | null; name: string; size: number; ring: number; color: string | null }) {
  const inner = size - ring * 2 - 8;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        border: `${ring}px solid ${color ?? "rgba(255,255,255,0.4)"}`,
        background: "rgba(8,11,15,0.6)",
        boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={inner} height={inner} style={{ width: inner, height: inner, borderRadius: 999, objectFit: "cover" }} alt="" />
      ) : (
        <div style={{ display: "flex", fontSize: Math.round(size * 0.38), fontWeight: 800, color: "#ffffff" }}>{name.slice(0, 2).toUpperCase()}</div>
      )}
    </div>
  );
}

function Backdrop({ data, photo, width, height }: { data: ShareImageData; photo: string | null; width: number; height: number }) {
  const full = { position: "absolute" as const, top: 0, left: 0, width, height };
  const home = data.home.color ?? FALLBACK_COLOR;
  const away = data.away.color ?? FALLBACK_COLOR;
  return (
    <>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} width={width} height={height} style={{ ...full, objectFit: "cover" }} alt="" />
      ) : (
        <div style={{ ...full, display: "flex", backgroundImage: `linear-gradient(115deg, ${home} 0%, ${BACKGROUND} 46%, ${BACKGROUND} 54%, ${away} 100%)` }} />
      )}
      <div
        style={{
          ...full,
          display: "flex",
          backgroundImage: "linear-gradient(180deg, rgba(5,8,12,0.66) 0%, rgba(5,8,12,0.1) 26%, rgba(5,8,12,0.14) 46%, rgba(5,8,12,0.84) 76%, rgba(5,8,12,0.96) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width,
          height: 12,
          display: "flex",
          backgroundImage: `linear-gradient(90deg, ${home}, ${data.accentColor}, ${away})`,
        }}
      />
    </>
  );
}

function StagePill({ data, fontSize }: { data: ShareImageData; fontSize: number }) {
  if (!data.stageLabel) return null;
  return (
    <div
      style={{
        display: "flex",
        padding: `${Math.round(fontSize * 0.24)}px ${Math.round(fontSize * 0.75)}px`,
        borderRadius: 999,
        background: data.accentColor,
        color: readableTextOn(data.accentColor),
        fontSize,
        fontWeight: 800,
        letterSpacing: 1,
        textTransform: "uppercase",
        boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
      }}
    >
      {data.stageLabel}
    </div>
  );
}

function Brand({ data, logo, logoSize, titleSize }: { data: ShareImageData; logo: string | null; logoSize: number; titleSize: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={logoSize} height={logoSize} style={{ width: logoSize, height: logoSize, borderRadius: 999, objectFit: "cover", marginRight: 18 }} alt="" />
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1, letterSpacing: 2, textTransform: "uppercase", color: "#ffffff" }}>
          {data.competitionName}
        </div>
        <div style={{ display: "flex", marginTop: 6, fontSize: Math.round(titleSize * 0.64), fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
          {`${data.modalityName} · ${data.dateLabel}`}
        </div>
      </div>
    </div>
  );
}

function Cover({ data, images }: { data: ShareImageData; images: Prepared }) {
  return (
    <div style={{ display: "flex", position: "relative", width: COVER_WIDTH, height: COVER_HEIGHT, background: BACKGROUND, fontFamily: "Barlow Condensed" }}>
      <Backdrop data={data} photo={images.photo} width={COVER_WIDTH} height={COVER_HEIGHT} />
      <div style={{ position: "absolute", top: 34, left: 44, right: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Brand data={data} logo={images.logo} logoSize={92} titleSize={44} />
        <StagePill data={data} fontSize={34} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 48, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {(["home", "away"] as const).map((which, index) => {
          const side = data[which];
          return (
            <div key={which} style={{ display: "flex", alignItems: "flex-end" }}>
              {index === 1 && (
                <div style={{ display: "flex", marginBottom: 118, fontSize: 104, fontWeight: 800, lineHeight: 1, color: data.accentColor, textShadow: "0 6px 22px rgba(0,0,0,0.6)" }}>
                  VS
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 480 }}>
                <Emblem src={which === "home" ? images.homeCrest : images.awayCrest} name={side.name} size={196} ring={8} color={side.color} />
                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    maxWidth: 470,
                    fontSize: fitFontSize(side.name, 460, 84, 36),
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#ffffff",
                    textAlign: "center",
                    textShadow: "0 4px 18px rgba(0,0,0,0.65)",
                  }}
                >
                  {side.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Faixas livres: ~250px no topo e ~330px embaixo (o app cobre com perfil/barra de resposta).
function Story({ data, images }: { data: ShareImageData; images: Prepared }) {
  const center = data.score ? (
    <div style={{ display: "flex", alignItems: "center", fontSize: 220, fontWeight: 800, lineHeight: 1, color: "#ffffff", textShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>
      <span>{data.score.home}</span>
      <span style={{ margin: "0 36px", color: data.accentColor }}>×</span>
      <span>{data.score.away}</span>
    </div>
  ) : (
    <div style={{ display: "flex", fontSize: 150, fontWeight: 800, lineHeight: 1, color: data.accentColor, textShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>VS</div>
  );
  const team = (which: "home" | "away") => {
    const side = data[which];
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 900 }}>
        <Emblem src={which === "home" ? images.homeCrest : images.awayCrest} name={side.name} size={300} ring={12} color={side.color} />
        <div
          style={{
            display: "flex",
            marginTop: 24,
            maxWidth: 900,
            fontSize: fitFontSize(side.name, 880, 110, 52),
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#ffffff",
            textAlign: "center",
            textShadow: "0 4px 18px rgba(0,0,0,0.65)",
          }}
        >
          {side.name}
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", position: "relative", width: STORY_WIDTH, height: STORY_HEIGHT, background: BACKGROUND, fontFamily: "Barlow Condensed" }}>
      <Backdrop data={data} photo={images.photo} width={STORY_WIDTH} height={STORY_HEIGHT} />
      <div style={{ position: "absolute", top: 260, left: 70, right: 70, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Brand data={data} logo={images.logo} logoSize={110} titleSize={58} />
        <div style={{ display: "flex", marginTop: 30 }}>
          <StagePill data={data} fontSize={44} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 640, left: 90, right: 90, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {team("home")}
        <div style={{ display: "flex", margin: "40px 0" }}>{center}</div>
        {team("away")}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 350,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          fontSize: 40,
          fontWeight: 600,
          color: withAlpha("#ffffff", 0.8),
          letterSpacing: 2,
        }}
      >
        {data.domain}
      </div>
    </div>
  );
}

async function prepare(data: ShareImageData, origin: string, photoWidth: number, photoHeight: number): Promise<Prepared> {
  const sharp = await loadSharp();
  const [photo, home, away, logo] = await Promise.all([
    fetchImage(data.photoUrl, origin),
    fetchImage(data.home.crestUrl, origin),
    fetchImage(data.away.crestUrl, origin),
    fetchImage(data.logoUrl, origin),
  ]);
  const [photoUri, homeCrest, awayCrest, logoUri] = await Promise.all([
    preparePhoto(photo, sharp, photoWidth, photoHeight),
    prepareEmblem(home, sharp),
    prepareEmblem(away, sharp),
    prepareEmblem(logo, sharp),
  ]);
  return { photo: photoUri, homeCrest, awayCrest, logo: logoUri };
}

const NO_IMAGES: Prepared = { photo: null, homeCrest: null, awayCrest: null, logo: null };

export async function renderShareImages(data: ShareImageData, origin: string): Promise<{ cover: RenderedImage; story: RenderedImage }> {
  const sharp = await loadSharp();
  const [coverImages, storyImages] = await Promise.all([
    prepare(data, origin, COVER_WIDTH, COVER_HEIGHT),
    prepare(data, origin, STORY_WIDTH, STORY_HEIGHT),
  ]);
  // Uma imagem num formato que o Satori não decodifica (sem sharp) não derruba a geração: sai só
  // com cores e nomes.
  const coverPng = await renderPng(<Cover data={data} images={coverImages} />, COVER_WIDTH, COVER_HEIGHT).catch(() =>
    renderPng(<Cover data={data} images={NO_IMAGES} />, COVER_WIDTH, COVER_HEIGHT),
  );
  const storyPng = await renderPng(<Story data={data} images={storyImages} />, STORY_WIDTH, STORY_HEIGHT).catch(() =>
    renderPng(<Story data={data} images={NO_IMAGES} />, STORY_WIDTH, STORY_HEIGHT),
  );
  const [cover, story] = await Promise.all([encodeForWeb(coverPng, sharp, 88), encodeForWeb(storyPng, sharp, 86)]);
  return { cover, story };
}
