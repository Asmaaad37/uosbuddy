/**
 * University of Sargodha grading table (Phase 6 task 9), from the official table:
 * 80–100 = A (4.00); 65–79 = B; 50–64 = C; 40–49 = D; below 40 = F (0).
 * Passing marks for a course are 50% (C) in the semester system.
 */
const POINTS: Record<number, number> = {
  79: 3.94,
  78: 3.87,
  77: 3.8,
  76: 3.74,
  75: 3.67,
  74: 3.6,
  73: 3.54,
  72: 3.47,
  71: 3.4,
  70: 3.34,
  69: 3.27,
  68: 3.2,
  67: 3.14,
  66: 3.07,
  65: 3.0,
  64: 2.92,
  63: 2.85,
  62: 2.78,
  61: 2.7,
  60: 2.64,
  59: 2.57,
  58: 2.5,
  57: 2.43,
  56: 2.36,
  55: 2.3,
  54: 2.24,
  53: 2.18,
  52: 2.12,
  51: 2.06,
  50: 2.0,
  49: 1.9,
  48: 1.8,
  47: 1.7,
  46: 1.6,
  45: 1.5,
  44: 1.4,
  43: 1.3,
  42: 1.2,
  41: 1.1,
  40: 1.0,
};

export const PASS_MARK = 50;

export type Grade = { letter: "A" | "B" | "C" | "D" | "F"; points: number; passed: boolean };

/** Marks out of 100 (whole numbers, as on the table) to letter grade and grade points. */
export function gradeFor(marks: number): Grade {
  const m = Math.floor(Math.min(100, Math.max(0, marks)));
  if (m >= 80) return { letter: "A", points: 4, passed: true };
  if (m < 40) return { letter: "F", points: 0, passed: false };
  const letter = m >= 65 ? "B" : m >= 50 ? "C" : "D";
  return { letter, points: POINTS[m]!, passed: m >= PASS_MARK };
}

export type CourseResult = { credits: number; marks: number | null };

/** Credit-weighted average of grade points, ignoring courses without marks yet. */
export function gpa(courses: CourseResult[]): { gpa: number | null; credits: number } {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    if (c.marks === null || !Number.isFinite(c.marks) || c.credits <= 0) continue;
    points += gradeFor(c.marks).points * c.credits;
    credits += c.credits;
  }
  return { gpa: credits ? Math.round((points / credits) * 100) / 100 : null, credits };
}

/** CGPA over every semester: the same weighting across all courses. */
export function cgpa(semesters: CourseResult[][]) {
  return gpa(semesters.flat());
}
