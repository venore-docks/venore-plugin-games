import type { Metadata } from "next";

// STUB — substituído pela implementação real (título, descrição e og:image com a capa pré-gerada).
export async function buildMatchMetadata(_matchId: string): Promise<Metadata> {
  return {};
}
export async function buildVoteHubMetadata(): Promise<Metadata> {
  return {};
}
export async function buildVoteMatchMetadata(_matchId: string): Promise<Metadata> {
  return {};
}
export async function buildParticipantMetadata(_slug: string): Promise<Metadata> {
  return {};
}
export async function buildAthleteMetadata(_slug: string): Promise<Metadata> {
  return {};
}
