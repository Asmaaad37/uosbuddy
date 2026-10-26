/**
 * Reads a UoS roll or registration number for the reviewer (formats in
 * supabase/seed/uos-catalogue.json). Returns null when the id doesn't parse.
 */
export function describeStudentId(id: string): string[] | null {
  const term = (t: string, yy: string) => `${t === "F" ? "Fall" : "Spring"} 20${yy}`;

  const roll = /^([A-Z]{2,8}?)(\d{2})([FS])(\d{2})([A-Z])(\d{3})$/.exec(id);
  if (roll) {
    const [, program, code, t, yy, category, serial] = roll;
    const kind =
      category === "R" ? "Regular" : category === "S" ? "Self-support" : `Category ${category}`;
    return [program!, term(t!, yy!), kind, `Code ${code}`, `#${serial}`];
  }

  const registration = /^(\d{2})([FS])-US-([A-Z]{2,5})-(\d{1,5})$/.exec(id);
  if (registration) {
    const [, yy, t, subject, serial] = registration;
    return [term(t!, yy!), subject!, `#${serial}`];
  }
  return null;
}
