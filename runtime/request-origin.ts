import { headers } from "next/headers";

// Origem absoluta do site (og:image, links de compartilhar, domínio nas imagens geradas). Prefere a
// URL configurada do site (AUTH_URL/NEXTAUTH_URL) — cabeçalho de host pode ser forjado fora da
// Vercel; sem ela, usa o host do request.
export async function resolveRequestOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // cai pro cabeçalho
    }
  }
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
