export const partyContactTypes = [
  "phone",
  "mobile",
  "email",
  "website"
] as const;

export type PartyContactType = (typeof partyContactTypes)[number];

export const partyContactPurposes = [
  "general",
  "sales",
  "purchasing",
  "accounting",
  "management",
  "other"
] as const;

export type PartyContactPurpose = (typeof partyContactPurposes)[number];

export interface PartyContact {
  readonly id: string;
  readonly type: PartyContactType;
  readonly value: string;
  readonly purpose: PartyContactPurpose;
  readonly isPrimary: boolean;
  readonly contactPerson: string | null;
  readonly title: string | null;
}

export interface PartyContactInput {
  readonly id: string;
  readonly type: PartyContactType;
  readonly value: string;
  readonly purpose?: PartyContactPurpose;
  readonly isPrimary?: boolean;
  readonly contactPerson?: string | null;
  readonly title?: string | null;
}

export type PartyContactErrorCode =
  | "party.contact.id.required"
  | "party.contact.type.invalid"
  | "party.contact.purpose.invalid"
  | "party.contact.value.invalid";

export class PartyContactError extends Error {
  constructor(readonly code: PartyContactErrorCode, message: string) {
    super(message);
    this.name = "PartyContactError";
  }
}

export function createPartyContact(input: PartyContactInput): PartyContact {
  const id = input.id.trim();
  if (!id) {
    throw new PartyContactError("party.contact.id.required", "Contact id is required.");
  }
  if (!partyContactTypes.includes(input.type)) {
    throw new PartyContactError("party.contact.type.invalid", "Unsupported contact type.");
  }
  const purpose = input.purpose ?? "general";
  if (!partyContactPurposes.includes(purpose)) {
    throw new PartyContactError("party.contact.purpose.invalid", "Unsupported contact purpose.");
  }

  const value = normalizePartyContactValue(input.type, input.value);
  const contactPerson = normalizeOptionalText(input.contactPerson);
  const title = normalizeOptionalText(input.title);

  return Object.freeze({
    id,
    type: input.type,
    value,
    purpose,
    isPrimary: input.isPrimary ?? false,
    contactPerson,
    title
  });
}

export function normalizePartyContactValue(type: PartyContactType, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PartyContactError("party.contact.value.invalid", "Contact value is required.");
  }

  switch (type) {
    case "phone":
    case "mobile": {
      const normalized = normalizeDigits(trimmed).replace(/[\s()\-]/g, "");
      if (!/^\+?\d{7,15}$/.test(normalized)) {
        throw new PartyContactError("party.contact.value.invalid", "Phone/mobile value is invalid.");
      }
      return normalized;
    }
    case "email": {
      const normalized = trimmed.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new PartyContactError("party.contact.value.invalid", "Email value is invalid.");
      }
      return normalized;
    }
    case "website": {
      let candidate = trimmed;
      if (!/^https?:\/\//i.test(candidate)) {
        candidate = `https://${candidate}`;
      }
      try {
        const parsed = new URL(candidate);
        if (!parsed.hostname.includes(".")) {
          throw new Error("invalid hostname");
        }
        return parsed.toString().replace(/\/$/, "");
      } catch {
        throw new PartyContactError("party.contact.value.invalid", "Website value is invalid.");
      }
    }
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
