import { NoOfficialApiError, type ClimbingGymProvider } from "../types";

/**
 * Climbing District. Native colour grading (White → Purple, Pink = mystery)
 * is fully supported in lib/grading. No public/authorised API is documented:
 * no live sync, no scraping. Grading reference: https://climbingdistrict.com/infos/faq/
 */
export const climbingDistrictProvider: ClimbingGymProvider = {
  providerId: "CLIMBING_DISTRICT",
  gradingSystem: "CLIMBING_DISTRICT_COLOR",
  liveSyncStatus: () => "NATIVE_GRADING_ONLY",
  async getGyms() {
    throw new NoOfficialApiError("Climbing District");
  },
};
