"use client";

import { useEffect, useState } from "react";
import { resolveTvStageTransform, type TvStageTransform } from "../../shared/tv-stage";

// Mede o viewport e devolve a escala do palco de 1920px (shared/tv-stage.ts). Antes de medir (SSR e
// hidratação) o palco sai 16:9 sem escala — composto, nunca em branco.
export function useTvStage(): TvStageTransform {
  const [transform, setTransform] = useState<TvStageTransform>(() => resolveTvStageTransform(0, 0));
  useEffect(() => {
    const measure = () => setTransform(resolveTvStageTransform(window.innerWidth, window.innerHeight));
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return transform;
}
