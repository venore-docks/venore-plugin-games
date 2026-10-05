// Slug pra URL pública (equipe, atleta, modalidade). Gerado do nome
// na criação; unicidade é de quem chama (runtime/slugs.ts:
// tenta o slug base, cai pro sufixo -2/-3/... em colisão).
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}
