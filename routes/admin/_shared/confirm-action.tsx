"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
} from "@venore/plugin-sdk/ui";
import type { ActionResult } from "./action-result";
import { useAction } from "./use-action";

// Confirmação de ação destrutiva/irreversível. `requireText` obriga a digitar um texto (nome da
// equipe, "ZERAR") — usado quando o estrago é grande e o botão fica perto de outros.
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  successMessage,
  requireText,
  destructive = true,
  onConfirm,
  redirectTo,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  successMessage: string;
  requireText?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { pending, run } = useAction();
  const blocked = requireText ? typed.trim() !== requireText : false;

  function confirm() {
    run(onConfirm, successMessage, () => {
      setOpen(false);
      setTyped("");
      if (redirectTo) router.push(redirectTo);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireText && (
          <div className="space-y-1.5">
            <label className="text-sm text-foreground">
              Digite <span className="font-semibold">{requireText}</span> para confirmar
            </label>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button type="button" variant={destructive ? "destructive" : "default"} disabled={pending || blocked} onClick={confirm}>
            {pending ? "Aguarde…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
