import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { BARLOW_CONDENSED_600_WOFF_BASE64, BARLOW_CONDENSED_800_WOFF_BASE64 } from "../../shared/fonts/barlow-condensed";

// Base comum das imagens geradas pelo plugin com next/og (Satori + Resvg: JSX → PNG, só flexbox e um
// subconjunto de CSS — nada de grid, color-mix nem filter): capa 1280×720 do jogo
// e story 1080×1920 (runtime/images/share-image.tsx), gerados UMA vez e salvos no MMS.
// Quando o `sharp` existe (optionalDependency do próprio Next), normaliza as imagens de entrada
// (orientação EXIF, recorte, SVG → PNG) e comprime a saída em JPEG.

const FETCH_TIMEOUT_MS = 8_000;
// Foto de celular passa de 8 MB às vezes; acima disso nem tenta (o upload do host já limita).
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
// Formatos que o Satori decodifica sozinho quando o sharp não está disponível pra normalizar.
const SATORI_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml"]);

export type FetchedImage = { buffer: Buffer; contentType: string };
// O construtor (default export) — `typeof import("sharp")` é o namespace do módulo, que a partir do
// sharp 0.35 (ESM, com .d.mts) não é mais chamável.
export type SharpFactory = typeof import("sharp").default;

let sharpPromise: Promise<SharpFactory | null> | null = null;

// Import dinâmico: sem sharp instalado a imagem continua saindo (em PNG), só sem normalizar
// orientação EXIF/tamanho da foto nem comprimir pra JPEG.
export function loadSharp(): Promise<SharpFactory | null> {
  if (!sharpPromise) {
    sharpPromise = import("sharp").then((mod) => mod.default).catch(() => null);
  }
  return sharpPromise;
}

// origin: base pra URLs de mídia relativas (driver "filesystem" do host serve em /api/media/...).
export async function fetchImage(url: string | null, origin: string): Promise<FetchedImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > MAX_IMAGE_BYTES ? null : { buffer, contentType };
  } catch {
    return null;
  }
}

export function toDataUri(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

// Foto: com sharp, gira pela orientação EXIF (foto de celular!), recorta no tamanho pedido no ponto
// de maior interesse e reencoda leve — o Satori ignora EXIF e ficaria lento com foto de 8 MB.
export async function preparePhoto(
  image: FetchedImage | null,
  sharp: SharpFactory | null,
  width: number,
  height: number,
): Promise<string | null> {
  if (!image) return null;
  if (sharp) {
    try {
      const jpeg = await sharp(image.buffer)
        .rotate()
        .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: 90 })
        .toBuffer();
      return toDataUri(jpeg, "image/jpeg");
    } catch {
      // cai pro arquivo original abaixo
    }
  }
  return SATORI_IMAGE_TYPES.has(image.contentType) ? toDataUri(image.buffer, image.contentType) : null;
}

// Brasão/logo: quadrado recortado no centro (mesmo object-cover redondo do site e da TV); SVG vira
// PNG aqui também.
export async function prepareEmblem(image: FetchedImage | null, sharp: SharpFactory | null, size = 320): Promise<string | null> {
  if (!image) return null;
  if (sharp) {
    try {
      const png = await sharp(image.buffer).resize(size, size, { fit: "cover" }).png().toBuffer();
      return toDataUri(png, "image/png");
    } catch {
      // cai pro arquivo original abaixo
    }
  }
  return SATORI_IMAGE_TYPES.has(image.contentType) ? toDataUri(image.buffer, image.contentType) : null;
}

export function ogFonts() {
  return [
    { name: "Barlow Condensed", data: Buffer.from(BARLOW_CONDENSED_800_WOFF_BASE64, "base64"), weight: 800 as const, style: "normal" as const },
    { name: "Barlow Condensed", data: Buffer.from(BARLOW_CONDENSED_600_WOFF_BASE64, "base64"), weight: 600 as const, style: "normal" as const },
  ];
}

export async function renderPng(element: ReactElement, width: number, height: number): Promise<Buffer> {
  const response = new ImageResponse(element, { width, height, fonts: ogFonts() });
  return Buffer.from(await response.arrayBuffer());
}

export type RenderedImage = { body: Buffer; contentType: "image/jpeg" | "image/png" };

// PNG → JPEG quando dá (foto em PNG passa fácil de 2 MB); sem sharp, PNG mesmo.
export async function encodeForWeb(png: Buffer, sharp: SharpFactory | null, quality = 88): Promise<RenderedImage> {
  if (sharp) {
    try {
      const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
      return { body: jpeg, contentType: "image/jpeg" };
    } catch {
      // PNG mesmo
    }
  }
  return { body: png, contentType: "image/png" };
}
