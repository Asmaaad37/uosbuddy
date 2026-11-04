/**
 * Phase 9 task 5: UOSBuddy's community guidelines. Shown on /guidelines and in the dialog
 * students accept before their first post, comment or listing.
 */
export const GUIDELINES_REQUIRED = "GUIDELINES_REQUIRED";

export const GUIDELINES: { title: string; body: string }[] = [
  {
    title: "Be kind, even when you disagree",
    body: "No insults, threats, bullying or slurs, about anyone: students, teachers, sects, ethnicities or genders.",
  },
  {
    title: "Keep people's private details private",
    body: "Never share someone's phone number, address, CNIC, photos or chats without their consent.",
  },
  {
    title: "No naming and shaming",
    body: "Report problems with a teacher or student to the university or to us. Don't post accusations about named people.",
  },
  {
    title: "Learn honestly",
    body: "Share notes and help each other, but don't sell or ask for exam papers, graded assignments or fake documents.",
  },
  {
    title: "Anonymous isn't a loophole",
    body: "Anonymous posts follow the same rules. Moderators can see who posted when the rules are broken.",
  },
  {
    title: "Trade and travel safely",
    body: "Meet on campus, never pay in advance, and never share bank or CNIC details. No scams or spam.",
  },
  {
    title: "Report, don't retaliate",
    body: "Use Report on anything that breaks these rules. Reports are private, and moderators review them quickly.",
  },
];

export const CONSEQUENCES =
  "Breaking the guidelines can get content removed, a warning, or a ban. Serious threats may be reported to the university.";
