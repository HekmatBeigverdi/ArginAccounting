import type { PurchaseWorkspaceDetail, PurchaseWorkspaceLineInput } from "../../composition/purchase/create-purchase-workspace-services";

export const latinDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export interface LineDraft {
  lineId?: string;
  productId: string;
  productTitle: string;
  quantity: string;
  unitId: string;
  unitTitle: string;
  unitPrice: string;
  discountPercent: string;
  chargeAmount: string;
  description: string;
  taxLabel?: string;
}
export const emptyLine = (): LineDraft => ({
  productId: "",
  productTitle: "",
  quantity: "",
  unitId: "",
  unitTitle: "",
  unitPrice: "",
  discountPercent: "0",
  chargeAmount: "0",
  description: "",
});

export function purchaseLineDrafts(detail: PurchaseWorkspaceDetail): LineDraft[] {
  return detail.document.lines.map((line): LineDraft => {
    const fact = detail.commercialFacts.find(fact => fact.purchaseLineId === line.lineId);
    if (!fact) throw new Error("اطلاعات مبلغ ردیف خرید یافت نشد.");
    const terms = fact.commercialTerms;
    if (terms.discounts.length > 1 || terms.charges.length > 1 ||
        terms.discounts.some(value => value.kind !== "percentage") ||
        terms.charges.some(value => value.kind !== "fixed")) {
      throw new Error("ویرایش این سند با چند تخفیف یا هزینه ترکیبی در این فرم پشتیبانی نمی‌شود.");
    }
    const discount = terms.discounts[0];
    const charge = terms.charges[0];
    return {
      lineId: line.lineId,
      productId: line.itemId, productTitle: line.itemSnapshot.displayName,
      quantity: terms.quantity.enteredQuantity,
      unitId: terms.quantity.enteredUnit.unitId, unitTitle: terms.quantity.enteredUnit.title,
      unitPrice: String(terms.unitPrice.amount),
      discountPercent: String(discount?.kind === "percentage" ? discount.rateBasisPoints / 100 : 0),
      chargeAmount: String(charge?.kind === "fixed" ? charge.amount.amount : 0),
      description: line.description ?? "",
      taxLabel: terms.tax.treatment === "taxable" ? (terms.tax.rateBasisPoints ?? 0) / 100 + "٪" : "معاف / مشمول نیست",
    };
  });
}

export function purchaseLineInput(line: LineDraft): PurchaseWorkspaceLineInput {
  return {
    lineId: line.lineId,
    productId: line.productId,
    quantity: latinDigits(line.quantity),
    unitId: line.unitId,
    unitPrice: Number(latinDigits(line.unitPrice)),
    discountRateBasisPoints: Math.round(
      Number(latinDigits(line.discountPercent || "0")) * 100,
    ),
    chargeAmount: Number(latinDigits(line.chargeAmount || "0")),
    description: line.description.trim() || null,
  };
}
