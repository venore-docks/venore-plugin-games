"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";

// Copia uma URL/id (overlay pro OBS, UUID pro CSV) sem precisar selecionar o texto no celular.
export function CopyButton({ value, label = "Copiar", size = "sm" }: { value: string; label?: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie o texto:", value);
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={copy} aria-label={`${label}: ${value}`}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copiado" : label}
    </Button>
  );
}
