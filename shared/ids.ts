// Id malformado na URL/form nunca chega ao Postgres (que lançaria erro de sintaxe de uuid = 500).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function uuidOrNull(value: unknown): string | null {
  return isUuid(value) ? value : null;
}
