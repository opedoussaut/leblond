import type { ClimbingGymProvider } from "../types";

/** Manual / other gyms: venues are created by climbers in LEBLOND itself. */
export const manualProvider: ClimbingGymProvider = {
  providerId: "OTHER",
  gradingSystem: "FONT",
  liveSyncStatus: () => "NATIVE_GRADING_ONLY",
  async getGyms() {
    return [];
  },
};
