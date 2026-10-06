import { encode } from "uqr";

// Matriz do QR code (lib uqr) convertida num único <path> SVG — sem <img>/data URL, então o QR
// escala nítido em qualquer resolução de OBS/TV e dá pra estilizar a cor por CSS. viewBox
// "0 0 size size": cada módulo escuro é um quadrado 1×1; runs horizontais viram um retângulo só
// (bem menos nós no DOM que um <rect> por módulo).
export type QrSvg = { size: number; path: string };

export function buildQrSvg(text: string): QrSvg {
  // ecc "M" (15%): folga pra compressão de vídeo da transmissão/brilho de TV sem inchar a matriz.
  const qr = encode(text, { ecc: "M", border: 0 });
  let path = "";
  qr.data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run += 1;
      path += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return { size: qr.size, path };
}
