"use client";

import { useEffect, type ReactNode } from "react";
import { Crest } from "../crest";
import type { DeskAthlete } from "./types";

// Folha inferior (bottom sheet) do console: confirmações, "quem fez?", encerrar jogo. Fecha no
// fundo escurecido e no Esc; o foco vai pro título pra leitor de tela anunciar.
export function Sheet({ title, onClose, children, closeLabel = "Fechar" }: { title: string; onClose: () => void; children: ReactNode; closeLabel?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="gm-c-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="gm-c-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="gm-c-sheet-head">
          <h2 className="gm-c-sheet-title">{title}</h2>
          <button type="button" className="gm-c-link" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function PeoplePicker({ athletes, selectedId, onPick, emptyMessage }: { athletes: DeskAthlete[]; selectedId?: string | null; onPick: (athlete: DeskAthlete) => void; emptyMessage: string }) {
  if (athletes.length === 0) return <p className="gm-c-sheet-text">{emptyMessage}</p>;
  return (
    <div className="gm-c-people">
      {athletes.map((athlete) => (
        <button key={athlete.id} type="button" className={`gm-c-person ${selectedId === athlete.id ? "on" : ""}`} aria-pressed={selectedId === athlete.id} onClick={() => onPick(athlete)}>
          <Crest url={athlete.photoUrl} name={athlete.name} className="gm-c-avatar" />
          <span className="gm-c-person-name">
            {athlete.number !== null ? `${athlete.number} · ` : ""}
            {athlete.name}
          </span>
        </button>
      ))}
    </div>
  );
}

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
};

export function ConfirmSheet({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return (
    <Sheet title={request.title} onClose={onClose} closeLabel="Voltar">
      <p className="gm-c-sheet-text">{request.message}</p>
      <div className="gm-c-row">
        <button type="button" className="gm-c-btn" onClick={onClose}>
          Voltar
        </button>
        <button
          type="button"
          className={`gm-c-btn ${request.tone === "danger" ? "danger" : "primary"}`}
          onClick={() => {
            onClose();
            request.onConfirm();
          }}
        >
          {request.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
