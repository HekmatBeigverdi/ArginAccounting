export interface NaturalPersonIdentity {
  readonly nationalCode: string | null;
  readonly economicNumber: string | null;
  readonly taxFileNumber: string | null;
}

export interface LegalEntityIdentity {
  readonly nationalId: string | null;
  readonly registrationNumber: string | null;
  readonly economicNumber: string | null;
  readonly legacyEconomicCode: string | null;
  readonly taxFileNumber: string | null;
}

export interface NaturalPersonIdentityInput {
  readonly nationalCode?: string | null;
  readonly economicNumber?: string | null;
  readonly taxFileNumber?: string | null;
}

export interface LegalEntityIdentityInput {
  readonly nationalId?: string | null;
  readonly registrationNumber?: string | null;
  readonly economicNumber?: string | null;
  readonly legacyEconomicCode?: string | null;
  readonly taxFileNumber?: string | null;
}

export type PartyIdentityErrorCode =
  | "party.identity.nationalCode.invalid"
  | "party.identity.nationalId.invalid"
  | "party.identity.registrationNumber.invalid"
  | "party.identity.economicNumber.invalid"
  | "party.identity.economicNumber.mismatch"
  | "party.identity.legacyEconomicCode.invalid"
  | "party.identity.taxFileNumber.invalid";

export class PartyIdentityError extends Error {
  constructor(
    readonly code: PartyIdentityErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PartyIdentityError";
  }
}

export function createNaturalPersonIdentity(
  input: NaturalPersonIdentityInput = {}
): NaturalPersonIdentity {
  const nationalCode = normalizeOptionalDigits(input.nationalCode);
  const economicNumber = normalizeOptionalDigits(input.economicNumber);
  const taxFileNumber = normalizeOptionalDigits(input.taxFileNumber);

  if (nationalCode !== null && !isValidIranianNationalCode(nationalCode)) {
    throw new PartyIdentityError(
      "party.identity.nationalCode.invalid",
      "Iranian natural-person national code is invalid."
    );
  }

  if (economicNumber !== null) {
    if (!/^\d{14}$/.test(economicNumber)) {
      throw new PartyIdentityError(
        "party.identity.economicNumber.invalid",
        "Natural-person economic number must contain 14 digits."
      );
    }
    if (nationalCode !== null && !economicNumber.startsWith(nationalCode)) {
      throw new PartyIdentityError(
        "party.identity.economicNumber.mismatch",
        "Natural-person economic number must start with the national code."
      );
    }
  }

  if (taxFileNumber !== null && !/^\d{1,30}$/.test(taxFileNumber)) {
    throw new PartyIdentityError(
      "party.identity.taxFileNumber.invalid",
      "Tax file number must contain only digits."
    );
  }

  return Object.freeze({ nationalCode, economicNumber, taxFileNumber });
}

export function createLegalEntityIdentity(
  input: LegalEntityIdentityInput = {}
): LegalEntityIdentity {
  const nationalId = normalizeOptionalDigits(input.nationalId);
  const registrationNumber = normalizeOptionalDigits(input.registrationNumber);
  const economicNumber = normalizeOptionalDigits(input.economicNumber);
  const legacyEconomicCode = normalizeOptionalDigits(input.legacyEconomicCode);
  const taxFileNumber = normalizeOptionalDigits(input.taxFileNumber);

  if (nationalId !== null && !isValidIranianLegalEntityNationalId(nationalId)) {
    throw new PartyIdentityError(
      "party.identity.nationalId.invalid",
      "Iranian legal-entity national identifier is invalid."
    );
  }

  if (registrationNumber !== null && !/^\d{1,20}$/.test(registrationNumber)) {
    throw new PartyIdentityError(
      "party.identity.registrationNumber.invalid",
      "Registration number must contain only digits."
    );
  }

  if (economicNumber !== null) {
    if (!/^\d{11}$/.test(economicNumber)) {
      throw new PartyIdentityError(
        "party.identity.economicNumber.invalid",
        "Current legal-entity economic number must contain 11 digits."
      );
    }
    if (nationalId !== null && economicNumber !== nationalId) {
      throw new PartyIdentityError(
        "party.identity.economicNumber.mismatch",
        "Current legal-entity economic number must match its national identifier."
      );
    }
  }

  if (legacyEconomicCode !== null && !/^\d{12}$/.test(legacyEconomicCode)) {
    throw new PartyIdentityError(
      "party.identity.legacyEconomicCode.invalid",
      "Legacy economic code must contain 12 digits."
    );
  }

  if (taxFileNumber !== null && !/^\d{1,30}$/.test(taxFileNumber)) {
    throw new PartyIdentityError(
      "party.identity.taxFileNumber.invalid",
      "Tax file number must contain only digits."
    );
  }

  return Object.freeze({
    nationalId,
    registrationNumber,
    economicNumber,
    legacyEconomicCode,
    taxFileNumber
  });
}

export function isValidIranianNationalCode(value: string): boolean {
  const digits = normalizeDigits(value);
  if (!/^\d{10}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }

  const remainder = sum % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  return Number(digits[9]) === expected;
}

export function isValidIranianLegalEntityNationalId(value: string): boolean {
  const digits = normalizeDigits(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const coefficients = [29, 27, 23, 19, 17] as const;
  const additiveFactor = Number(digits[9]) + 2;
  let sum = 0;

  for (let index = 0; index < 10; index += 1) {
    const coefficient = coefficients[index % coefficients.length];
    if (coefficient === undefined) {
      return false;
    }
    sum += (Number(digits[index]) + additiveFactor) * coefficient;
  }

  let expected = sum % 11;
  if (expected === 10) {
    expected = 0;
  }
  return Number(digits[10]) === expected;
}

export function normalizeIranianIdentifier(value: string): string {
  return normalizeDigits(value).replace(/[\s\-]/g, "");
}

function normalizeOptionalDigits(value: string | null | undefined): string | null {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  return normalizeIranianIdentifier(value);
}

function normalizeDigits(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
