/** Normalise a Somali number to 252XXXXXXXXX, the digits-only form wa.me needs. */
export function toWhatsAppDigits(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("252")) {
    if (digits.startsWith("0")) digits = "252" + digits.slice(1);
    else if (digits.length === 9) digits = "252" + digits;
  }
  return digits;
}

/** A click-to-chat link with a pre-written message, or null if no number is set. */
export function whatsappLink(number: string | null | undefined, message: string): string | null {
  const digits = toWhatsAppDigits(number ?? "");
  if (digits.length < 9) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
