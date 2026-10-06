import { cn } from "@venore/plugin-sdk/ui";
import { initials, safeColor } from "./lib/match-info";

// Brasão da equipe / foto do atleta. URLs já vêm do snapshot na variante pequena (runtime/snapshot.ts
// DISPLAY_IMAGE_WIDTH); sem imagem, iniciais sobre token do tema com a cor da equipe (dado do
// cadastro) só no anel — nunca como fundo, pra não depender de contraste de uma cor qualquer.

const SIZES = {
  xs: { box: "size-6 text-[0.6rem]", px: 24 },
  sm: { box: "size-8 text-xs", px: 32 },
  md: { box: "size-10 text-sm", px: 40 },
  lg: { box: "size-14 text-base", px: 56 },
  xl: { box: "size-20 text-xl sm:size-24 sm:text-2xl", px: 96 },
} as const;

export type AvatarSize = keyof typeof SIZES;

function Avatar({
  name,
  imageUrl,
  color,
  size,
  rounded,
  className,
}: {
  name: string;
  imageUrl: string | null;
  color: string | null;
  size: AvatarSize;
  rounded: "full" | "panel";
  className?: string;
}) {
  const { box, px } = SIZES[size];
  const ring = safeColor(color);
  const shape = rounded === "full" ? "rounded-full" : "rounded-xl";
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 bg-muted object-cover", shape, box, className)}
        style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center bg-muted font-display font-bold text-muted-foreground", shape, box, className)}
      style={{ boxShadow: `inset 0 0 0 2px ${ring ?? "var(--border)"}` }}
    >
      {initials(name)}
    </span>
  );
}

export function Crest(props: { name: string; crestUrl: string | null; color: string | null; size?: AvatarSize; className?: string }) {
  return <Avatar name={props.name} imageUrl={props.crestUrl} color={props.color} size={props.size ?? "md"} rounded="full" className={props.className} />;
}

export function AthletePhoto(props: { name: string; photoUrl: string | null; color: string | null; size?: AvatarSize; className?: string }) {
  return <Avatar name={props.name} imageUrl={props.photoUrl} color={props.color} size={props.size ?? "md"} rounded="full" className={props.className} />;
}

// Faixa fina com as duas cores da equipe (topo de card/capa de perfil).
export function TeamStripe({ primary, secondary, className }: { primary: string | null; secondary: string | null; className?: string }) {
  const a = safeColor(primary);
  const b = safeColor(secondary) ?? a;
  if (!a) return <div aria-hidden="true" className={cn("h-1 bg-primary", className)} />;
  return <div aria-hidden="true" className={cn("h-1", className)} style={{ background: `linear-gradient(90deg, ${a} 0 60%, ${b} 60% 100%)` }} />;
}
