"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionToast } from "@venore/plugin-sdk/ui";
import type { ActionResult } from "./action-result";

// Roda uma Server Action com toast de sucesso/erro e recarrega os dados da página (a action sobe a
// versão do snapshot; o refresh só re-renderiza o RSC com a versão nova).
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({ error: null, success: null });
  useActionToast({ pending, error: feedback.error, successMessage: feedback.success });

  const run = useCallback(
    (action: () => Promise<ActionResult>, successMessage: string | null, onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void) => {
      startTransition(async () => {
        let result: ActionResult;
        try {
          result = await action();
        } catch {
          result = { ok: false, message: "Falha inesperada. Tente de novo." };
        }
        if (result.ok) {
          setFeedback({ error: null, success: result.message ?? successMessage });
          onSuccess?.(result);
          router.refresh();
        } else {
          setFeedback({ error: result.message, success: null });
        }
      });
    },
    [router],
  );

  return { pending, run };
}
