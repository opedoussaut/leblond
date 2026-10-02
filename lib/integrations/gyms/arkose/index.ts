import { NoOfficialApiError, type ClimbingGymProvider } from "../types";

/**
 * Arkose. Native colour grading (Yellow → Purple) is fully supported in
 * lib/grading. No public/authorised Arkose API is documented, so there is no
 * live sync: getGyms() refuses rather than scraping. When an official API or
 * export exists, implement it here and map into the canonical model.
 * Grading reference: https://arkose.com/groupe/actus/niveau-escalade-bloc-couleur-tout-comprendre
 */
export const arkoseProvider: ClimbingGymProvider = {
  providerId: "ARKOSE",
  gradingSystem: "ARKOSE_COLOR",
  liveSyncStatus: () => "NATIVE_GRADING_ONLY",
  async getGyms() {
    throw new NoOfficialApiError("Arkose");
  },
};
