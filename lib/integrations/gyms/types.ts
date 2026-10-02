import type { GradeSystem, GymBrand } from "@/lib/climbing/types";

/** Gym-network adapter contract (brief §27). */
export interface ExternalGym {
  externalId: string;
  name: string;
  city: string | null;
  brand: GymBrand;
}
export interface ExternalClimbingSession {
  externalId: string;
  gymExternalId: string;
  startedAt: Date;
}
export interface ExternalProblem {
  externalId: string;
  nativeGrade: string;
  system: GradeSystem;
}

export type LiveSyncStatus = "NATIVE_GRADING_ONLY" | "AUTHORIZED_SYNC";

export interface ClimbingGymProvider {
  providerId: GymBrand;
  gradingSystem: GradeSystem;
  /** "NATIVE_GRADING_ONLY" until an official, authorised API is configured. */
  liveSyncStatus(): LiveSyncStatus;
  getGyms(): Promise<ExternalGym[]>;
  getSessions?(userId: string): Promise<ExternalClimbingSession[]>;
  getProblems?(sessionId: string): Promise<ExternalProblem[]>;
}

export class NoOfficialApiError extends Error {
  constructor(provider: string) {
    super(`${provider}: no official/authorised API is configured; LEBLOND uses native grading + manual logging.`);
  }
}
