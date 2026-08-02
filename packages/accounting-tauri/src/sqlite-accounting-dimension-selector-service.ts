import {
  type AccountDimensionRequirement,
  type AccountingDimensionSelectorField,
  type AccountingDimensionSelectorModel,
  type AccountingDimensionSelectorService,
  type LoadAccountingDimensionSelectorRequest,
} from "@argin/accounting";
import type { DatabaseExecutor, DatabaseSession } from "@argin/database";

interface SelectorPolicyRow {
  readonly dimension_type_id: string;
  readonly requirement: AccountDimensionRequirement;
  readonly code: string;
  readonly name: string;
  readonly hierarchical: number;
  readonly allow_multiple_members: number;
}

interface SelectorMemberRow {
  readonly id: string;
  readonly dimension_type_id: string;
  readonly code: string;
  readonly name: string;
  readonly parent_id: string | null;
  readonly display_order: number;
}

export class SqliteAccountingDimensionSelectorService
  implements AccountingDimensionSelectorService
{
  constructor(private readonly database: DatabaseExecutor) {}

  async load(
    request: LoadAccountingDimensionSelectorRequest,
  ): Promise<AccountingDimensionSelectorModel> {
    const normalized = normalizeRequest(request);

    return this.database.transaction(async (session) => {
      const policies = await this.loadPolicies(session, normalized);
      const members = await this.loadMembers(session, normalized, policies);
      const membersByType = groupMembersByType(members);
      const assignments = new Map(
        (normalized.assignments ?? []).map((assignment) => [
          assignment.dimensionTypeId,
          assignment.memberIds,
        ]),
      );

      return Object.freeze({
        companyId: normalized.companyId,
        accountId: normalized.accountId,
        documentDate: normalized.documentDate,
        fields: Object.freeze(
          policies.map((policy) =>
            mapField(policy, membersByType, assignments),
          ),
        ),
      });
    });
  }

  private loadPolicies(
    session: DatabaseSession,
    request: LoadAccountingDimensionSelectorRequest,
  ): Promise<readonly SelectorPolicyRow[]> {
    return session.query<SelectorPolicyRow>(
      `SELECT
         policy.dimension_type_id,
         policy.requirement,
         dimension_type.code,
         dimension_type.name,
         dimension_type.hierarchical,
         dimension_type.allow_multiple_members
       FROM account_dimension_policies AS policy
       INNER JOIN accounting_dimension_types AS dimension_type
         ON dimension_type.company_id = policy.company_id
        AND dimension_type.id = policy.dimension_type_id
       WHERE policy.company_id = ?
         AND policy.account_id = ?
         AND dimension_type.status = 'active'
       ORDER BY dimension_type.display_order, dimension_type.code, dimension_type.id`,
      [request.companyId, request.accountId],
    );
  }

  private loadMembers(
    session: DatabaseSession,
    request: LoadAccountingDimensionSelectorRequest,
    policies: readonly SelectorPolicyRow[],
  ): Promise<readonly SelectorMemberRow[]> {
    const selectableTypeIds = policies
      .filter((policy) => policy.requirement !== "forbidden")
      .map((policy) => policy.dimension_type_id);

    if (selectableTypeIds.length === 0) return Promise.resolve([]);

    return session.query<SelectorMemberRow>(
      `SELECT
         id, dimension_type_id, code, name, parent_id, display_order
       FROM accounting_dimension_members
       WHERE company_id = ?
         AND status = 'active'
         AND dimension_type_id IN (${placeholders(selectableTypeIds)})
         AND (valid_from IS NULL OR valid_from <= ?)
         AND (valid_to IS NULL OR valid_to >= ?)
       ORDER BY dimension_type_id, display_order, code, id`,
      [
        request.companyId,
        ...selectableTypeIds,
        request.documentDate,
        request.documentDate,
      ],
    );
  }
}

function normalizeRequest(
  request: LoadAccountingDimensionSelectorRequest,
): LoadAccountingDimensionSelectorRequest {
  const companyId = requireIdentifier(request.companyId, "companyId");
  const accountId = requireIdentifier(request.accountId, "accountId");
  if (!isValidIsoDate(request.documentDate)) {
    throw new Error("Accounting dimension selector documentDate must use YYYY-MM-DD.");
  }

  return Object.freeze({
    companyId,
    accountId,
    documentDate: request.documentDate,
    assignments: Object.freeze(
      (request.assignments ?? []).map((assignment) =>
        Object.freeze({
          dimensionTypeId: requireIdentifier(
            assignment.dimensionTypeId,
            "dimensionTypeId",
          ),
          memberIds: Object.freeze(
            assignment.memberIds.map((id) => requireIdentifier(id, "memberId")),
          ),
        }),
      ),
    ),
  });
}

function mapField(
  policy: SelectorPolicyRow,
  membersByType: ReadonlyMap<string, readonly SelectorMemberRow[]>,
  assignments: ReadonlyMap<string, readonly string[]>,
): AccountingDimensionSelectorField {
  const options = policy.requirement === "forbidden"
    ? []
    : (membersByType.get(policy.dimension_type_id) ?? []).map((member) =>
        Object.freeze({
          id: member.id,
          code: member.code,
          name: member.name,
          parentId: member.parent_id,
          displayOrder: member.display_order,
        }),
      );
  const allowedIds = new Set(options.map((option) => option.id));
  const selectedMemberIds = policy.requirement === "forbidden"
    ? []
    : (assignments.get(policy.dimension_type_id) ?? [])
        .filter((id) => allowedIds.has(id))
        .slice(0, policy.allow_multiple_members === 1 ? undefined : 1);

  return Object.freeze({
    dimensionTypeId: policy.dimension_type_id,
    code: policy.code,
    label: policy.name,
    requirement: policy.requirement,
    required: policy.requirement === "required",
    disabled: policy.requirement === "forbidden",
    multiple: policy.allow_multiple_members === 1,
    hierarchical: policy.hierarchical === 1,
    selectedMemberIds: Object.freeze(selectedMemberIds),
    options: Object.freeze(options),
  });
}

function groupMembersByType(
  members: readonly SelectorMemberRow[],
): ReadonlyMap<string, readonly SelectorMemberRow[]> {
  const groups = new Map<string, SelectorMemberRow[]>();
  for (const member of members) {
    const values = groups.get(member.dimension_type_id) ?? [];
    values.push(member);
    groups.set(member.dimension_type_id, values);
  }
  return groups;
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized === "") throw new Error(`Accounting dimension selector ${field} is required.`);
  return normalized;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}
