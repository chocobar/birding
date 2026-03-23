/**
 * Validates UK postcode format
 * Supports formats like: SW1A 1AA, EC1A1BB, M1 1AE, B33 8TH
 */
export function validatePostcode(postcode: string): boolean {
  if (!postcode || typeof postcode !== 'string') {
    return false;
  }

  // Remove all whitespace and convert to uppercase
  const normalized = postcode.replace(/\s/g, '').toUpperCase();

  // UK postcode regex pattern
  // Format: 1-2 letters, 1-2 digits, optional letter, space, 1 digit, 2 letters
  const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/;

  return postcodeRegex.test(normalized);
}

/**
 * Normalizes a UK postcode to standard format (uppercase with space)
 * Example: "sw1a1aa" -> "SW1A 1AA"
 */
export function normalizePostcode(postcode: string): string {
  if (!postcode) return '';

  // Remove all whitespace and convert to uppercase
  const cleaned = postcode.replace(/\s/g, '').toUpperCase();

  // Insert space before the last 3 characters
  if (cleaned.length >= 5) {
    const outward = cleaned.slice(0, -3);
    const inward = cleaned.slice(-3);
    return `${outward} ${inward}`;
  }

  return cleaned;
}

/**
 * Checks if a postcode is a partial/area code (e.g., "SW1A" or "M1")
 */
export function isPartialPostcode(postcode: string): boolean {
  if (!postcode) return false;

  const normalized = postcode.replace(/\s/g, '').toUpperCase();

  // Partial postcode: 1-2 letters followed by 1-2 digits and optional letter
  const partialRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?$/;

  return partialRegex.test(normalized);
}