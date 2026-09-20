import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";

export type PurchaseSupplierClassification = "natural-person" | "legal-entity";
export type PurchaseTaxTreatment = "unspecified" | "taxable" | "exempt" | "not-subject";
export type PurchaseSnapshotItemType = "product" | "service";

export interface PurchaseSupplierSnapshot {
  readonly companyId: string;
  readonly supplierId: string;
  readonly code: string;
  readonly displayName: string;
  readonly classification: PurchaseSupplierClassification;
  readonly nationalCode: string | null;
  readonly nationalId: string | null;
  readonly economicNumber: string | null;
  readonly taxFileNumber: string | null;
}

export interface CreatePurchaseSupplierSnapshotInput extends PurchaseSupplierSnapshot {}

export interface PurchaseUnitSnapshot {
  readonly unitId: string;
  readonly code: string;
  readonly title: string;
  readonly taxpayerUnitCode: string | null;
}

export interface CreatePurchaseUnitSnapshotInput {
  readonly unitId: string;
  readonly code: string;
  readonly title: string;
  readonly taxpayerUnitCode?: string | null;
}

export interface PurchaseItemSnapshot {
  readonly itemId: string;
  readonly itemType: PurchaseSnapshotItemType;
  readonly code: string;
  readonly displayName: string;
  readonly sku: string | null;
  readonly referenceCode: string | null;
  readonly taxpayerGoodsServiceId: string | null;
  readonly purchaseDescription: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly stockTracking: boolean;
  readonly taxTreatment: PurchaseTaxTreatment;
  readonly vatRateBasisPoints: number | null;
  readonly defaultPurchaseUnit: PurchaseUnitSnapshot | null;
}

export interface CreatePurchaseItemSnapshotInput {
  readonly itemId: string;
  readonly itemType: PurchaseSnapshotItemType;
  readonly code: string;
  readonly displayName: string;
  readonly sku?: string | null;
  readonly referenceCode?: string | null;
  readonly taxpayerGoodsServiceId?: string | null;
  readonly purchaseDescription?: string | null;
  readonly brand?: string | null;
  readonly model?: string | null;
  readonly stockTracking: boolean;
  readonly taxTreatment: PurchaseTaxTreatment;
  readonly vatRateBasisPoints: number | null;
  readonly defaultPurchaseUnit?: CreatePurchaseUnitSnapshotInput | null;
}

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

function requiredText(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim().replace(/\s+/gu, " ");
}

function optionalText(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.snapshotInvalid, field);
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length === 0 ? null : normalized;
}

export function createPurchaseSupplierSnapshot(
  input: CreatePurchaseSupplierSnapshotInput,
): PurchaseSupplierSnapshot {
  if (
    input.classification !== "natural-person" &&
    input.classification !== "legal-entity"
  ) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.snapshotInvalid,
      "supplierSnapshot.classification",
    );
  }

  return Object.freeze({
    companyId: requiredText(input.companyId, "supplierSnapshot.companyId"),
    supplierId: requiredText(input.supplierId, "supplierSnapshot.supplierId"),
    code: requiredText(input.code, "supplierSnapshot.code"),
    displayName: requiredText(input.displayName, "supplierSnapshot.displayName"),
    classification: input.classification,
    nationalCode: optionalText(input.nationalCode, "supplierSnapshot.nationalCode"),
    nationalId: optionalText(input.nationalId, "supplierSnapshot.nationalId"),
    economicNumber: optionalText(
      input.economicNumber,
      "supplierSnapshot.economicNumber",
    ),
    taxFileNumber: optionalText(
      input.taxFileNumber,
      "supplierSnapshot.taxFileNumber",
    ),
  });
}

export function createPurchaseUnitSnapshot(
  input: CreatePurchaseUnitSnapshotInput,
): PurchaseUnitSnapshot {
  return Object.freeze({
    unitId: requiredText(input.unitId, "itemSnapshot.defaultPurchaseUnit.unitId"),
    code: requiredText(
      input.code,
      "itemSnapshot.defaultPurchaseUnit.code",
    ).toUpperCase(),
    title: requiredText(input.title, "itemSnapshot.defaultPurchaseUnit.title"),
    taxpayerUnitCode: optionalText(
      input.taxpayerUnitCode,
      "itemSnapshot.defaultPurchaseUnit.taxpayerUnitCode",
    ),
  });
}

export function createPurchaseItemSnapshot(
  input: CreatePurchaseItemSnapshotInput,
): PurchaseItemSnapshot {
  if (input.itemType !== "product" && input.itemType !== "service") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.snapshotInvalid, "itemSnapshot.itemType");
  }
  if (typeof input.stockTracking !== "boolean") {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.snapshotInvalid,
      "itemSnapshot.stockTracking",
    );
  }
  if (input.itemType === "service" && input.stockTracking) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.itemSnapshotMismatch,
      "itemSnapshot.stockTracking",
    );
  }

  const taxpayerGoodsServiceId = optionalText(
    input.taxpayerGoodsServiceId,
    "itemSnapshot.taxpayerGoodsServiceId",
  );
  if (
    taxpayerGoodsServiceId !== null &&
    !/^\d{13}$/u.test(taxpayerGoodsServiceId)
  ) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.taxpayerIdentifierInvalid,
      "itemSnapshot.taxpayerGoodsServiceId",
    );
  }

  const taxTreatments: readonly PurchaseTaxTreatment[] = [
    "unspecified",
    "taxable",
    "exempt",
    "not-subject",
  ];
  if (!taxTreatments.includes(input.taxTreatment)) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.taxSnapshotInvalid,
      "itemSnapshot.taxTreatment",
    );
  }

  if (input.taxTreatment === "taxable") {
    if (
      input.vatRateBasisPoints === null ||
      !Number.isInteger(input.vatRateBasisPoints) ||
      input.vatRateBasisPoints < 0 ||
      input.vatRateBasisPoints > 10_000
    ) {
      return fail(
        PURCHASE_DOMAIN_ERROR_CODES.taxSnapshotInvalid,
        "itemSnapshot.vatRateBasisPoints",
      );
    }
  } else if (input.vatRateBasisPoints !== null) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.taxSnapshotInvalid,
      "itemSnapshot.vatRateBasisPoints",
    );
  }

  return Object.freeze({
    itemId: requiredText(input.itemId, "itemSnapshot.itemId"),
    itemType: input.itemType,
    code: requiredText(input.code, "itemSnapshot.code"),
    displayName: requiredText(input.displayName, "itemSnapshot.displayName"),
    sku: optionalText(input.sku, "itemSnapshot.sku"),
    referenceCode: optionalText(input.referenceCode, "itemSnapshot.referenceCode"),
    taxpayerGoodsServiceId,
    purchaseDescription: optionalText(
      input.purchaseDescription,
      "itemSnapshot.purchaseDescription",
    ),
    brand: optionalText(input.brand, "itemSnapshot.brand"),
    model: optionalText(input.model, "itemSnapshot.model"),
    stockTracking: input.stockTracking,
    taxTreatment: input.taxTreatment,
    vatRateBasisPoints: input.vatRateBasisPoints,
    defaultPurchaseUnit: input.defaultPurchaseUnit == null
      ? null
      : createPurchaseUnitSnapshot(input.defaultPurchaseUnit),
  });
}
