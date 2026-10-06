import type { ConfirmRequest } from "./sheets";
import type { ControlActionResult } from "./types";

// Contrato entre o console e os painéis: rodar uma action (com estado "ocupado" por botão e aviso
// de erro), mostrar aviso, pedir confirmação.
export type RunOptions = { refresh?: boolean; silentCodes?: string[] };

export type ControlOps = {
  channelKey: string;
  channelName: string;
  isBusy: (key: string) => boolean;
  run: (key: string, action: () => Promise<ControlActionResult>, options?: RunOptions) => Promise<ControlActionResult | null>;
  toast: (text: string, tone?: "error" | "ok") => void;
  confirm: (request: ConfirmRequest) => void;
};
