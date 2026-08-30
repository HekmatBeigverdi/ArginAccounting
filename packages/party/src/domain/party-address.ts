export const partyAddressPurposes = [
  "registered",
  "billing",
  "shipping",
  "operational",
  "postal",
  "other"
] as const;

export type PartyAddressPurpose = (typeof partyAddressPurposes)[number];

export interface PartyAddress {
  readonly id: string;
  readonly purpose: PartyAddressPurpose;
  readonly countryCode: "IR";
  readonly province: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly addressLine: string;
  readonly postalCode: string | null;
  readonly isPrimary: boolean;
}

export interface PartyAddressInput {
  readonly id: string;
  readonly purpose?: PartyAddressPurpose;
  readonly province?: string | null;
  readonly city?: string | null;
  readonly district?: string | null;
  readonly addressLine: string;
  readonly postalCode?: string | null;
  readonly isPrimary?: boolean;
}

export type PartyAddressErrorCode =
  | "party.address.id.required"
  | "party.address.purpose.invalid"
  | "party.address.line.required"
  | "party.address.postalCode.invalid";

export class PartyAddressError extends Error {
  constructor(readonly code: PartyAddressErrorCode, message: string) {
    super(message);
    this.name = "PartyAddressError";
  }
}

export function createPartyAddress(input: PartyAddressInput): PartyAddress {
  const id = input.id.trim();
  if (!id) {
    throw new PartyAddressError("party.address.id.required", "Address id is required.");
  }

  const purpose = input.purpose ?? "other";
  if (!partyAddressPurposes.includes(purpose)) {
    throw new PartyAddressError("party.address.purpose.invalid", "Unsupported address purpose.");
  }

  const addressLine = input.addressLine.trim();
  if (!addressLine) {
    throw new PartyAddressError("party.address.line.required", "Address line is required.");
  }

  const postalCode = normalizeOptionalDigits(input.postalCode);
  if (postalCode !== null && !/^\d{10}$/.test(postalCode)) {
    throw new PartyAddressError(
      "party.address.postalCode.invalid",
      "Iranian postal code must contain 10 digits."
    );
  }

  return Object.freeze({
    id,
    purpose,
    countryCode: "IR",
    province: normalizeOptionalText(input.province),
    city: normalizeOptionalText(input.city),
    district: normalizeOptionalText(input.district),
    addressLine,
    postalCode,
    isPrimary: input.isPrimary ?? false
  });
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalDigits(value: string | null | undefined): string | null {
  if (value == null || value.trim().length === 0) return null;
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s\-]/g, "");
}
