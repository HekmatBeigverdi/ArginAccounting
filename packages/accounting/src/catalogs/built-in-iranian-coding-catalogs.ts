import type {
  CodingTemplateAccountItem,
  CodingTemplateAccountReportClassification,
  CodingTemplateAccountDimensionPolicyItem,
  CodingTemplateDimensionTypeItem,
  CodingTemplateVersionContent,
} from "../domain/coding-template-items.ts";
import { createCodingTemplateVersionContent } from "../domain/create-coding-template-version-content.ts";
import type { CodingTemplateCatalog } from "./coding-template-catalog.ts";

type AccountDefinition = Pick<
  CodingTemplateAccountItem,
  "logicalKey" | "parentLogicalKey" | "level" | "code" | "persianName" |
  "englishName" | "nature" | "normalBalance" | "statementType" |
  "postingAllowed" | "currencyEnabled" | "revaluationEnabled" |
  "trackingEnabled" | "dueDateEnabled" | "displayOrder"
> & Partial<CodingTemplateAccountReportClassification>;

const dimensions: readonly CodingTemplateDimensionTypeItem[] = [
  dimension("dimension.branch", "BRANCH", "شعبه", "Branch", false, false, 10),
  dimension("dimension.cost-center", "COST_CENTER", "مرکز هزینه", "Cost center", true, false, 20),
  dimension("dimension.project", "PROJECT", "پروژه", "Project", true, false, 30),
  dimension("dimension.party", "PARTY", "طرف حساب", "Party", false, false, 40),
];

const sharedAccounts: readonly AccountDefinition[] = [
  account("assets", null, "group", "1", "دارایی‌ها", "Assets", "debit", "balance_sheet", false, 100, { balanceSheetSection: "assets" }),
  account("assets.current", "assets", "general", "11", "دارایی‌های جاری", "Current assets", "debit", "balance_sheet", false, 110, { balanceSheetSection: "assets" }),
  account("assets.current.cash", "assets.current", "subsidiary", "1101", "موجودی نقد و بانک", "Cash and banks", "strict_debit", "balance_sheet", true, 111, { balanceSheetSection: "assets", cashFlowCategory: "cash_and_cash_equivalents", cashEquivalent: true }, { currencyEnabled: true, revaluationEnabled: true }),
  account("assets.current.receivables", "assets.current", "subsidiary", "1102", "حساب‌های دریافتنی تجاری", "Trade receivables", "debit", "balance_sheet", true, 112, { balanceSheetSection: "assets", cashFlowCategory: "operating", receivable: true }, { trackingEnabled: true, dueDateEnabled: true }),
  account("assets.current.prepayments", "assets.current", "subsidiary", "1103", "پیش‌پرداخت‌ها", "Prepayments", "debit", "balance_sheet", true, 113, { balanceSheetSection: "assets", cashFlowCategory: "operating" }),
  account("assets.non-current", "assets", "general", "12", "دارایی‌های غیرجاری", "Non-current assets", "debit", "balance_sheet", false, 120, { balanceSheetSection: "assets" }),
  account("assets.non-current.fixed-assets", "assets.non-current", "subsidiary", "1201", "دارایی‌های ثابت مشهود", "Property, plant and equipment", "debit", "balance_sheet", true, 121, { balanceSheetSection: "assets", cashFlowCategory: "investing" }),
  account("assets.non-current.accumulated-depreciation", "assets.non-current", "subsidiary", "1202", "استهلاک انباشته", "Accumulated depreciation", "credit", "balance_sheet", true, 122, { balanceSheetSection: "assets", cashFlowCategory: "non_cash" }),
  account("liabilities", null, "group", "2", "بدهی‌ها", "Liabilities", "credit", "balance_sheet", false, 200, { balanceSheetSection: "liabilities" }),
  account("liabilities.current", "liabilities", "general", "21", "بدهی‌های جاری", "Current liabilities", "credit", "balance_sheet", false, 210, { balanceSheetSection: "liabilities" }),
  account("liabilities.current.payables", "liabilities.current", "subsidiary", "2101", "حساب‌های پرداختنی تجاری", "Trade payables", "credit", "balance_sheet", true, 211, { balanceSheetSection: "liabilities", cashFlowCategory: "operating", payable: true }, { trackingEnabled: true, dueDateEnabled: true }),
  account("liabilities.current.taxes", "liabilities.current", "subsidiary", "2102", "مالیات و عوارض پرداختنی", "Taxes payable", "credit", "balance_sheet", true, 212, { balanceSheetSection: "liabilities", cashFlowCategory: "operating", payable: true }),
  account("liabilities.current.accruals", "liabilities.current", "subsidiary", "2103", "هزینه‌های پرداختنی", "Accrued expenses", "credit", "balance_sheet", true, 213, { balanceSheetSection: "liabilities", cashFlowCategory: "operating", payable: true }),
  account("equity", null, "group", "3", "حقوق مالکانه", "Equity", "credit", "balance_sheet", false, 300, { balanceSheetSection: "equity" }),
  account("equity.capital", "equity", "general", "31", "سرمایه و اندوخته‌ها", "Capital and reserves", "credit", "balance_sheet", false, 310, { balanceSheetSection: "equity" }),
  account("equity.capital.registered", "equity.capital", "subsidiary", "3101", "سرمایه", "Capital", "strict_credit", "balance_sheet", true, 311, { balanceSheetSection: "equity", cashFlowCategory: "financing" }),
  account("equity.capital.retained-earnings", "equity.capital", "subsidiary", "3102", "سود و زیان انباشته", "Retained earnings", "credit", "balance_sheet", true, 312, { balanceSheetSection: "equity", cashFlowCategory: "non_cash" }),
  account("expenses", null, "group", "6", "هزینه‌ها", "Expenses", "debit", "income_statement", false, 600, { incomeStatementSection: "operating_expenses" }),
  account("expenses.operating", "expenses", "general", "61", "هزینه‌های عملیاتی", "Operating expenses", "debit", "income_statement", false, 610, { incomeStatementSection: "operating_expenses" }),
  account("expenses.operating.payroll", "expenses.operating", "subsidiary", "6101", "حقوق و دستمزد", "Payroll expense", "strict_debit", "income_statement", true, 611, { incomeStatementSection: "operating_expenses", cashFlowCategory: "operating" }),
  account("expenses.operating.rent", "expenses.operating", "subsidiary", "6102", "اجاره", "Rent expense", "strict_debit", "income_statement", true, 612, { incomeStatementSection: "operating_expenses", cashFlowCategory: "operating" }),
  account("expenses.operating.utilities", "expenses.operating", "subsidiary", "6103", "آب، برق، گاز و مخابرات", "Utilities", "strict_debit", "income_statement", true, 613, { incomeStatementSection: "operating_expenses", cashFlowCategory: "operating" }),
  account("expenses.finance", "expenses", "general", "62", "هزینه‌های مالی", "Finance costs", "debit", "income_statement", false, 620, { incomeStatementSection: "finance_costs" }),
  account("expenses.finance.bank", "expenses.finance", "subsidiary", "6201", "هزینه‌های بانکی و تأمین مالی", "Bank and finance costs", "strict_debit", "income_statement", true, 621, { incomeStatementSection: "finance_costs", cashFlowCategory: "financing" }),
  account("memorandum", null, "group", "9", "حساب‌های انتظامی", "Memorandum accounts", "uncontrolled", "memorandum", false, 900),
  account("memorandum.general", "memorandum", "general", "91", "حساب‌های انتظامی", "Memorandum accounts", "uncontrolled", "memorandum", false, 910),
  account("memorandum.general.items", "memorandum.general", "subsidiary", "9101", "اقلام انتظامی", "Memorandum items", "uncontrolled", "memorandum", true, 911),
];

const serviceAccounts: readonly AccountDefinition[] = [
  account("revenue", null, "group", "4", "درآمدها", "Revenue", "credit", "income_statement", false, 400, { incomeStatementSection: "revenue" }),
  account("revenue.operating", "revenue", "general", "41", "درآمدهای عملیاتی", "Operating revenue", "credit", "income_statement", false, 410, { incomeStatementSection: "revenue" }),
  account("revenue.operating.services", "revenue.operating", "subsidiary", "4101", "درآمد ارائه خدمات", "Service revenue", "strict_credit", "income_statement", true, 411, { incomeStatementSection: "revenue", cashFlowCategory: "operating", managementTags: ["درآمد خدمات"] }),
  account("costs", null, "group", "5", "بهای تمام‌شده خدمات", "Cost of services", "debit", "income_statement", false, 500, { incomeStatementSection: "cost_of_sales" }),
  account("costs.service", "costs", "general", "51", "هزینه مستقیم خدمات", "Direct service costs", "debit", "income_statement", false, 510, { incomeStatementSection: "cost_of_sales" }),
  account("costs.service.direct-labor", "costs.service", "subsidiary", "5101", "دستمزد مستقیم خدمات", "Direct service labor", "strict_debit", "income_statement", true, 511, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["بهای خدمات"] }),
  account("costs.service.subcontract", "costs.service", "subsidiary", "5102", "خدمات پیمانکاران", "Subcontractor services", "strict_debit", "income_statement", true, 512, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["بهای خدمات"] }),
];

const tradingAccounts: readonly AccountDefinition[] = [
  account("assets.current.inventory", "assets.current", "subsidiary", "1104", "موجودی کالا", "Merchandise inventory", "strict_debit", "balance_sheet", true, 114, { balanceSheetSection: "assets", cashFlowCategory: "operating", managementTags: ["موجودی کالا"] }),
  account("revenue", null, "group", "4", "درآمدها", "Revenue", "credit", "income_statement", false, 400, { incomeStatementSection: "revenue" }),
  account("revenue.operating", "revenue", "general", "41", "فروش", "Sales", "credit", "income_statement", false, 410, { incomeStatementSection: "revenue" }),
  account("revenue.operating.goods", "revenue.operating", "subsidiary", "4101", "فروش کالا", "Goods sales", "strict_credit", "income_statement", true, 411, { incomeStatementSection: "revenue", cashFlowCategory: "operating", managementTags: ["فروش کالا"] }),
  account("costs", null, "group", "5", "بهای تمام‌شده", "Cost of sales", "debit", "income_statement", false, 500, { incomeStatementSection: "cost_of_sales" }),
  account("costs.merchandise", "costs", "general", "51", "بهای تمام‌شده کالای فروش‌رفته", "Cost of goods sold", "debit", "income_statement", false, 510, { incomeStatementSection: "cost_of_sales" }),
  account("costs.merchandise.sold", "costs.merchandise", "subsidiary", "5101", "بهای تمام‌شده کالای فروش‌رفته", "Cost of goods sold", "strict_debit", "income_statement", true, 511, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["بهای کالای فروش‌رفته"] }),
  account("purchases", null, "group", "7", "خرید و تعدیلات خرید", "Purchases", "debit", "income_statement", false, 700, { incomeStatementSection: "cost_of_sales" }),
  account("purchases.merchandise", "purchases", "general", "71", "خرید کالا", "Merchandise purchases", "debit", "income_statement", false, 710, { incomeStatementSection: "cost_of_sales" }),
  account("purchases.merchandise.domestic", "purchases.merchandise", "subsidiary", "7101", "خرید داخلی کالا", "Domestic merchandise purchases", "strict_debit", "income_statement", true, 711, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating" }),
];

const manufacturingAccounts: readonly AccountDefinition[] = [
  account("assets.current.raw-materials", "assets.current", "subsidiary", "1104", "موجودی مواد اولیه", "Raw materials inventory", "strict_debit", "balance_sheet", true, 114, { balanceSheetSection: "assets", cashFlowCategory: "operating", managementTags: ["مواد اولیه"] }),
  account("assets.current.work-in-progress", "assets.current", "subsidiary", "1105", "کالای در جریان ساخت", "Work in progress", "strict_debit", "balance_sheet", true, 115, { balanceSheetSection: "assets", cashFlowCategory: "operating", managementTags: ["در جریان ساخت"] }),
  account("assets.current.finished-goods", "assets.current", "subsidiary", "1106", "کالای ساخته‌شده", "Finished goods", "strict_debit", "balance_sheet", true, 116, { balanceSheetSection: "assets", cashFlowCategory: "operating", managementTags: ["کالای ساخته‌شده"] }),
  account("revenue", null, "group", "4", "درآمدها", "Revenue", "credit", "income_statement", false, 400, { incomeStatementSection: "revenue" }),
  account("revenue.operating", "revenue", "general", "41", "فروش محصولات", "Product sales", "credit", "income_statement", false, 410, { incomeStatementSection: "revenue" }),
  account("revenue.operating.products", "revenue.operating", "subsidiary", "4101", "فروش محصولات تولیدی", "Manufactured product sales", "strict_credit", "income_statement", true, 411, { incomeStatementSection: "revenue", cashFlowCategory: "operating", managementTags: ["فروش محصول"] }),
  account("costs", null, "group", "5", "بهای تمام‌شده تولید", "Manufacturing costs", "debit", "income_statement", false, 500, { incomeStatementSection: "cost_of_sales" }),
  account("costs.manufacturing", "costs", "general", "51", "هزینه‌های تولید", "Manufacturing costs", "debit", "income_statement", false, 510, { incomeStatementSection: "cost_of_sales" }),
  account("costs.manufacturing.material", "costs.manufacturing", "subsidiary", "5101", "مواد مستقیم مصرفی", "Direct materials", "strict_debit", "income_statement", true, 511, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["مواد مستقیم"] }),
  account("costs.manufacturing.labor", "costs.manufacturing", "subsidiary", "5102", "دستمزد مستقیم تولید", "Direct manufacturing labor", "strict_debit", "income_statement", true, 512, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["دستمزد مستقیم"] }),
  account("costs.manufacturing.overhead", "costs.manufacturing", "subsidiary", "5103", "سربار تولید", "Manufacturing overhead", "strict_debit", "income_statement", true, 513, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["سربار تولید"] }),
  account("costs.manufacturing.goods-sold", "costs.manufacturing", "subsidiary", "5104", "بهای تمام‌شده کالای فروش‌رفته", "Cost of manufactured goods sold", "strict_debit", "income_statement", true, 514, { incomeStatementSection: "cost_of_sales", cashFlowCategory: "operating", managementTags: ["بهای کالای فروش‌رفته"] }),
];

export const IRAN_SERVICE_CODING_CATALOG = catalog("iran-service-default", "service", "الگوی کدینگ خدماتی ایران", "Iranian service coding template", serviceAccounts);
export const IRAN_TRADING_CODING_CATALOG = catalog("iran-trading-default", "trading", "الگوی کدینگ بازرگانی ایران", "Iranian trading coding template", tradingAccounts);
export const IRAN_MANUFACTURING_CODING_CATALOG = catalog("iran-manufacturing-default", "manufacturing", "الگوی کدینگ تولیدی ایران", "Iranian manufacturing coding template", manufacturingAccounts);

export const BUILT_IN_IRANIAN_CODING_CATALOGS = Object.freeze([
  IRAN_SERVICE_CODING_CATALOG,
  IRAN_TRADING_CODING_CATALOG,
  IRAN_MANUFACTURING_CODING_CATALOG,
] as const);

export function getBuiltInIranianCodingCatalog(code: CodingTemplateCatalog["templateCode"]): CodingTemplateCatalog {
  const result = BUILT_IN_IRANIAN_CODING_CATALOGS.find((item) => item.templateCode === code);
  if (!result) throw new RangeError(`Unknown built-in coding catalog: ${code}`);
  return result;
}

function catalog(code: CodingTemplateCatalog["templateCode"], activityType: CodingTemplateCatalog["activityType"], persianName: string, englishName: string, specific: readonly AccountDefinition[]): CodingTemplateCatalog {
  const accounts = [...sharedAccounts, ...specific].map(buildAccount);
  const content: CodingTemplateVersionContent = {
    accounts,
    dimensionTypes: dimensions,
    dimensionMembers: [],
    accountDimensionPolicies: policies(accounts),
  };
  return Object.freeze({ templateCode: code, activityType, version: 1, contractVersion: "1.0", persianName, englishName, content: createCodingTemplateVersionContent(content) });
}

function account(logicalKey: string, parentLogicalKey: string | null, level: CodingTemplateAccountItem["level"], code: string, persianName: string, englishName: string, nature: CodingTemplateAccountItem["nature"], statementType: CodingTemplateAccountItem["statementType"], postingAllowed: boolean, displayOrder: number, classification: Partial<CodingTemplateAccountReportClassification> = {}, behavior: Partial<Pick<CodingTemplateAccountItem, "currencyEnabled" | "revaluationEnabled" | "trackingEnabled" | "dueDateEnabled">> = {}): AccountDefinition {
  return { logicalKey, parentLogicalKey, level, code, persianName, englishName, nature, normalBalance: nature === "credit" || nature === "strict_credit" ? "credit" : "debit", statementType, postingAllowed, currencyEnabled: behavior.currencyEnabled ?? false, revaluationEnabled: behavior.revaluationEnabled ?? false, trackingEnabled: behavior.trackingEnabled ?? false, dueDateEnabled: behavior.dueDateEnabled ?? false, displayOrder, ...classification };
}

function buildAccount(item: AccountDefinition): CodingTemplateAccountItem {
  return { logicalKey: item.logicalKey, parentLogicalKey: item.parentLogicalKey, level: item.level, code: item.code, persianName: item.persianName, englishName: item.englishName, nature: item.nature, normalBalance: item.normalBalance, statementType: item.statementType, reportClassification: { balanceSheetSection: item.balanceSheetSection ?? null, incomeStatementSection: item.incomeStatementSection ?? null, cashFlowCategory: item.cashFlowCategory ?? null, cashEquivalent: item.cashEquivalent ?? false, receivable: item.receivable ?? false, payable: item.payable ?? false, managementTags: item.managementTags ?? [] }, postingAllowed: item.postingAllowed, currencyEnabled: item.currencyEnabled, revaluationEnabled: item.revaluationEnabled, trackingEnabled: item.trackingEnabled, dueDateEnabled: item.dueDateEnabled, activeByDefault: true, displayOrder: item.displayOrder };
}

function dimension(logicalKey: string, code: string, persianName: string, englishName: string, hierarchical: boolean, allowMultipleMembers: boolean, displayOrder: number): CodingTemplateDimensionTypeItem {
  return { logicalKey, code, persianName, englishName, hierarchical, allowMultipleMembers, activeByDefault: true, displayOrder };
}

function policies(accounts: readonly CodingTemplateAccountItem[]): readonly CodingTemplateAccountDimensionPolicyItem[] {
  const result: CodingTemplateAccountDimensionPolicyItem[] = [];
  for (const item of accounts.filter((candidate) => candidate.postingAllowed)) {
    result.push({ accountLogicalKey: item.logicalKey, dimensionTypeLogicalKey: "dimension.branch", requirement: "optional" });
    if (item.reportClassification.receivable || item.reportClassification.payable) result.push({ accountLogicalKey: item.logicalKey, dimensionTypeLogicalKey: "dimension.party", requirement: "required" });
    if (item.statementType === "income_statement") {
      result.push({ accountLogicalKey: item.logicalKey, dimensionTypeLogicalKey: "dimension.cost-center", requirement: "required" });
      result.push({ accountLogicalKey: item.logicalKey, dimensionTypeLogicalKey: "dimension.project", requirement: "optional" });
    }
  }
  return result;
}
