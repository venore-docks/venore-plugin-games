import type { CSSProperties } from "react";
import { monogram } from "./live-style";

// Brasão/foto com fallback de iniciais. Sem hooks: serve tanto pra server quanto pra client
// components. As classes vêm de quem usa (cada tela tem o próprio CSS prefixado).
export function Crest({ url, name, className, monoClassName, style }: { url: string | null; name: string; className: string; monoClassName?: string; style?: CSSProperties }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- tela standalone (OBS/TV), imagem já em variante do Blob
    return <img className={className} src={url} alt="" style={style} />;
  }
  return (
    <span className={monoClassName ?? className} style={style} aria-hidden="true">
      {monogram(name)}
    </span>
  );
}
