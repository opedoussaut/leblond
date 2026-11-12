import { NoOfficialApiError, type ClimbingGymProvider } from "../types";

/**
 * Climbing District. Bouldering is graded with numbered levels 1–12 (current
 * scale); the former colours (White → Purple, Pink = mystery) stay supported
 * for what was logged with them (lib/grading). No public/authorised API is
 * documented: no live sync, no scraping. Grading reference: https://climbingdistrict.com/infos/faq/
 */
export const climbingDistrictProvider: ClimbingGymProvider = {
  providerId: "CLIMBING_DISTRICT",
  gradingSystem: "CLIMBING_DISTRICT_LEVEL",
  liveSyncStatus: () => "NATIVE_GRADING_ONLY",
  async getGyms() {
    throw new NoOfficialApiError("Climbing District");
  },
};
