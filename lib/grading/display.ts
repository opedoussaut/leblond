/**
 * How grades are written on screen: boulder grades in capitals (5A, 5C, 6B+),
 * route grades in lowercase (5a, 6a+). Display only: stored grades stay
 * exactly as entered (the Font scale stores 1a–5c in lowercase).
 */
export function boulderGrade(grade: string): string {
  return /^[1-9][abc]\+?$/i.test(grade) ? grade.toUpperCase() : grade;
}
