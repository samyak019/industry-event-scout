import type { Preferences, RawCandidate } from "../types";

export type AdapterContext = {
  prefs: Preferences;
  now: Date;
  retrievedAt: string;
};

export type AdapterOutput = {
  candidates: RawCandidate[];
  status?: "ok" | "partial" | "disabled";
  message: string;
};

export type SourceAdapter = {
  name: string;
  run(ctx: AdapterContext): Promise<AdapterOutput>;
};
