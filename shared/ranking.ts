// Posição de cada linha de um ranking já ordenado (maior valor primeiro), com empate dividindo a
// posição ("1, 1, 3") — pra medalha não ir só pro primeiro de dois empatados. Usado pelos rankings
// de atletas (artilharia, MVPs, craque da torcida) e pelas parciais da votação.
export function rankPositions(sortedValues: number[]): number[] {
  const positions: number[] = [];
  sortedValues.forEach((value, index) => {
    positions.push(index > 0 && value === sortedValues[index - 1] ? positions[index - 1] : index + 1);
  });
  return positions;
}
