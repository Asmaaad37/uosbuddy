/**
 * Phase 10 launch kit: the "Invite your batch" message for WhatsApp, where UoS batches
 * actually talk. English with a little Roman Urdu, short enough to read in a preview.
 */
export function inviteMessage({
  batchLabel,
  count,
  url,
}: {
  batchLabel: string | null;
  count: number;
  url: string;
}) {
  const who =
    batchLabel && count > 1
      ? `${count} of ${batchLabel} are already on UOSBuddy`
      : "I'm on UOSBuddy";
  return `${who} 🎓 Find our batch, share notes, ask for backup, and plan rides home. Sirf verified UoS students. Join here: ${url}`;
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
