import { describe, expect, it } from "vitest";
import { buildQrSvg } from "./qr";

// Reconstrói a matriz a partir do path (cada "M{x} {y}h{run}" liga `run` módulos na linha y).
function pathToMatrix(size: number, path: string): boolean[][] {
  const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let offset = 0; offset < Number(run); offset++) {
      matrix[Number(y)][Number(x) + offset] = true;
    }
  }
  return matrix;
}

// Padrão localizador 7×7: borda escura, anel claro, miolo 3×3 escuro.
function hasFinderAt(matrix: boolean[][], top: number, left: number): boolean {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const border = y === 0 || y === 6 || x === 0 || x === 6;
      const core = y >= 2 && y <= 4 && x >= 2 && x <= 4;
      if (matrix[top + y][left + x] !== (border || core)) return false;
    }
  }
  return true;
}

describe("buildQrSvg", () => {
  it("gera uma matriz QR válida (tamanho 21+4v, localizadores nos três cantos)", () => {
    const { size, path } = buildQrSvg("https://games.example.com.br/votar");
    expect((size - 21) % 4).toBe(0);
    const matrix = pathToMatrix(size, path);
    expect(hasFinderAt(matrix, 0, 0)).toBe(true);
    expect(hasFinderAt(matrix, 0, size - 7)).toBe(true);
    expect(hasFinderAt(matrix, size - 7, 0)).toBe(true);
  });

  it("junta módulos vizinhos num run só (path enxuto)", () => {
    const { path } = buildQrSvg("x");
    expect(path).toMatch(/^M0 0h7v1h-7z/);
  });
});
