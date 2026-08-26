const KENYAN_MPESA_PHONE_PATTERN = /^(?:254|0)?[17]\d{8}$/;

/**
 * Convert a Kenyan M-PESA subscriber number to the canonical 254XXXXXXXXX form.
 * Returns null when the supplied value is not a supported Kenyan mobile number.
 */
export function normalizeMpesaPhoneNumber(value: string): string | null {
  const digits = value.trim().replace(/[\s()+-]/g, "");

  if (!/^\d+$/.test(digits) || !KENYAN_MPESA_PHONE_PATTERN.test(digits)) {
    return null;
  }

  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return `254${digits}`;
}

export function formatMpesaPhoneNumber(value: string): string {
  const normalized = normalizeMpesaPhoneNumber(value);
  return normalized ? `0${normalized.slice(3)}` : value;
}
