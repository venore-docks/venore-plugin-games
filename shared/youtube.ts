// Link do jogo (matches.youtube_url) — colado à mão pelo admin na súmula, então precisa ser
// tolerante ao que a pessoa realmente cola: link de "assistir" (watch?v=), link curto (youtu.be/),
// live em andamento (/live/) ou já um link de embed. Guardamos a URL como o admin colou (pra
// "Assistir no YouTube ↗" sempre funcionar mesmo se o id não bater em nenhum padrão conhecido) e só
// extraímos o id na hora de montar o player embutido da página do jogo (rota pública do jogo).

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{6,}$/;

// Aceita colar qualquer link de vídeo/live do YouTube (ou vazio, pra limpar) — outros domínios são
// rejeitados (retorna null) porque a página do jogo assume YouTube pro embed; a URL fica só
// guardada, não validada além disso (o vídeo pode ainda nem existir/estar privado, não dá pra saber
// sem chamar a API).
export function sanitizeYoutubeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Só http(s): um "javascript://youtube.com/..." passava no plugin antigo e ia parar num href.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host !== "youtube.com" && host !== "youtu.be" && host !== "youtube-nocookie.com") return null;

  return url.toString();
}

// Extrai o id do vídeo pra montar .../embed/<id> — cobre watch?v=, youtu.be/<id>, /live/<id>,
// /embed/<id> e /shorts/<id>. null quando o formato não é reconhecido (link ainda funciona como
// "Assistir no YouTube ↗", só não ganha player embutido na página).
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/);
      id = match ? match[1] : null;
    }
  }

  return id && YOUTUBE_ID.test(id) ? id : null;
}

// Miniatura do vídeo servida pela CDN do YouTube (i.ytimg.com) — a galeria de jogos
// (blocos de jogos) usa isto quando o jogo ainda não tem capa gerada: é a mesma
// imagem quando o admin sobe a capa no YouTube, e não custa CPU da Vercel pra N jogos de uma vez.
// hqdefault (480×360) existe pra todo vídeo/live; o conteúdo 16:9 vem com faixa preta em cima e
// embaixo, então quem exibe recorta com object-cover num box aspect-video.
export function youtubeThumbnailUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const id = extractYoutubeVideoId(rawUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
