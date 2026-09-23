import assert from "node:assert/strict";
import test from "node:test";

import type {
  AccountDimensionPolicy,
  AccountingDimensionMember,
  AccountingDimensionType,
} from "@argin/accounting";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingFact,
  collectPurchasePostingDimensionReferences,
  resolvePurchasePostingDimensionAssignments,
} from "../src/index.ts";

function fact() {
  const amounts = {
    currency: "IRR",
    grossAmount: 9_000,
    discountAmount: 0,
    netAfterDiscount: 9_000,
    chargeAmount: 100,
    taxBaseAmount: 9_100,
    taxAmount: 910,
    grandTotal: 10_010,
  };

  return createPurchasePostingFact({
    factId: "fact-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: "invoice-001",
    purchaseDocumentVersion: 1,
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
    documentNumber: "PINV-001",
    businessDate: "2026-09-23",
    supplier: {
      companyId: "company-001",
      supplierId: "supplier-001",
      code: "SUP-001",
      displayName: "Supplier",
      nationalCode: null,
      nationalId: null,
      economicNumber: null,
      taxFileNumber: null,
    },
    lines: [{
      purchaseLineId: "line-stock",
      position: 1,
      lineKind: "stock-product",
      item: {
        itemId: "product-001",
        itemType: "product",
        code: "P-001",
        displayName: "Product",
        taxpayerGoodsServiceId: null,
        stockTracking: true,
      },
      baseQuantity: "1",
      amounts,
      valuations: [{
        companyId: "company-001",
        valuationEntryId: "valuation-001",
        movementId: "movement-001",
        inventoryDocumentId: "receipt-001",
        inventoryLineId: "receipt-line-001",
        productId: "product-001",
        warehouseId: "warehouse-001",
        policyId: "valuation-policy-001",
        method: "fifo",
        strategyVersion: 1,
        currency: "IRR",
        quantity: "1",
        unitCost: "9100",
        totalCost: 9_100,
      }],
    }],
    totals: amounts,
    capturedAt: "2026-09-23T12:00:00.000Z",
  });
}

function type(
  id: string,
  code: string,
  allowMultipleMembers = false,
): AccountingDimensionType {
  return {
    id,
    companyId: "company-001",
    code,
    name: code,
    englishName: null,
    hierarchical: false,
    allowMultipleMembers,
    status: "active",
    displayOrder: 1,
    source: "module",
    sourceReferenceId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

function member(
  id: string,
  dimensionTypeId: string,
  sourceReferenceId: string,
): AccountingDimensionMember {
  return {
    id,
    companyId: "company-001",
    dimensionTypeId,
    code: id,
    name: id,
    englishName: null,
    parentId: null,
    status: "active",
    validFrom: null,
    validTo: null,
    displayOrder: 1,
    source: "module",
    sourceReferenceId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

const TYPES = [
  type("dim-party", "PARTY"),
  type("dim-product", "PRODUCT"),
  type("dim-warehouse", "WAREHOUSE"),
  type("dim-cost-center", "COST_CENTER"),
  type("dim-project", "PROJECT"),
];

const MEMBERS = new Map<string, AccountingDimensionMember>([
  ["party:supplier-001", member("member-party-supplier", "dim-party", "supplier-001")],
  ["product:product-001", member("member-product-001", "dim-product", "product-001")],
  ["warehouse:warehouse-001", member("member-warehouse-001", "dim-warehouse", "warehouse-001")],
  ["cost-center:cc-001", member("member-cc-001", "dim-cost-center", "cc-001")],
  ["project:project-001", member("member-project-001", "dim-project", "project-001")],
]);

function policy(
  accountId: string,
  dimensionTypeId: string,
  requirement: "required" | "optional" | "forbidden",
): AccountDimensionPolicy {
  return {
    id: `policy-${accountId}-${dimensionTypeId}`,
    companyId: "company-001",
    accountId,
    dimensionTypeId,
    requirement,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

function reader(policies: readonly AccountDimensionPolicy[]) {
  return {
    async findPoliciesForAccount(_companyId: string, accountId: string) {
      return policies.filter(item => item.accountId === accountId);
    },
    async findTypesByCompanyId() {
      return TYPES;
    },
    async resolveMemberBySource(
      _companyId: string,
      source: "party" | "product" | "warehouse" | "cost-center" | "project",
      sourceReferenceId: string,
    ) {
      return MEMBERS.get(`${source}:${sourceReferenceId}`) ?? null;
    },
    async findMembersByIds(ids: readonly string[]) {
      const values = [...MEMBERS.values()];
      return values.filter(item => ids.includes(item.id));
    },
  };
}

test("collects Party plus line Product/Warehouse and explicit Cost Center/Project references", () => {
  const refs = collectPurchasePostingDimensionReferences(
    fact(),
    "line-stock",
    {
      costCenterId: "cc-001",
      projectId: "project-001",
    },
  );

  assert.deepEqual(refs, [
    { source: "party", sourceReferenceId: "supplier-001" },
    { source: "cost-center", sourceReferenceId: "cc-001" },
    { source: "project", sourceReferenceId: "project-001" },
    { source: "product", sourceReferenceId: "product-001" },
    { source: "warehouse", sourceReferenceId: "warehouse-001" },
  ]);
});

test("resolves only dimensions allowed by account policies", async () => {
  const assignments = await resolvePurchasePostingDimensionAssignments({
    fact: fact(),
    sourceLineId: "line-stock",
    accountId: "acc-inventory",
    dimensionContext: {
      costCenterId: "cc-001",
      projectId: "project-001",
    },
  }, reader([
    policy("acc-inventory", "dim-product", "required"),
    policy("acc-inventory", "dim-warehouse", "required"),
    policy("acc-inventory", "dim-cost-center", "optional"),
    policy("acc-inventory", "dim-project", "forbidden"),
  ]));

  assert.deepEqual(assignments, [
    { dimensionTypeId: "dim-cost-center", memberIds: ["member-cc-001"] },
    { dimensionTypeId: "dim-product", memberIds: ["member-product-001"] },
    { dimensionTypeId: "dim-warehouse", memberIds: ["member-warehouse-001"] },
  ]);
});

test("supplier payable can require Party dimension without Product/Warehouse", async () => {
  const assignments = await resolvePurchasePostingDimensionAssignments({
    fact: fact(),
    sourceLineId: null,
    accountId: "acc-ap",
  }, reader([
    policy("acc-ap", "dim-party", "required"),
  ]));

  assert.deepEqual(assignments, [
    { dimensionTypeId: "dim-party", memberIds: ["member-party-supplier"] },
  ]);
});

test("required configured dimension missing from source context fails explicitly", async () => {
  await assert.rejects(
    () => resolvePurchasePostingDimensionAssignments({
      fact: fact(),
      sourceLineId: "line-stock",
      accountId: "acc-inventory",
      dimensionContext: null,
    }, reader([
      policy("acc-inventory", "dim-project", "required"),
    ])),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(
        error.code,
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.dimensionRequiredMissing,
      );
      return true;
    },
  );
});

test("unconfigured dimensions are not injected into Journal lines", async () => {
  const assignments = await resolvePurchasePostingDimensionAssignments({
    fact: fact(),
    sourceLineId: "line-stock",
    accountId: "acc-inventory",
  }, reader([]));

  assert.deepEqual(assignments, []);
});
