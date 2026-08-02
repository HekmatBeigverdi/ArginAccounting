import {
  AccountingDimensionAssignmentValidationError,
  validateAccountingDimensionAssignments,
  type AccountDimensionPolicy,
  type AccountingDimensionAssignmentValidationIssue,
  type AccountingDimensionAssignmentValidationService,
  type AccountingDimensionMember,
  type AccountingDimensionType,
  type ValidateDimensionAssignmentsRequest,
} from "@argin/accounting";
import type { DatabaseExecutor, DatabaseSession } from "@argin/database";

interface PolicyRow {
  readonly id: string;
  readonly company_id: string;
  readonly account_id: string;
  readonly dimension_type_id: string;
  readonly requirement: AccountDimensionPolicy["requirement"];
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

interface DimensionTypeRow {
  readonly id: string;
  readonly company_id: string;
  readonly code: string;
  readonly name: string;
  readonly english_name: string | null;
  readonly hierarchical: number;
  readonly allow_multiple_members: number;
  readonly status: AccountingDimensionType["status"];
  readonly display_order: number;
  readonly source: AccountingDimensionType["source"];
  readonly source_reference_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

interface MemberRow {
  readonly id: string;
  readonly company_id: string;
  readonly dimension_type_id: string;
  readonly code: string;
  readonly name: string;
  readonly english_name: string | null;
  readonly parent_id: string | null;
  readonly status: AccountingDimensionMember["status"];
  readonly valid_from: string | null;
  readonly valid_to: string | null;
  readonly display_order: number;
  readonly source: AccountingDimensionMember["source"];
  readonly source_reference_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export class SqliteAccountingDimensionAssignmentValidationService
  implements AccountingDimensionAssignmentValidationService
{
  constructor(private readonly database: DatabaseExecutor) {}

  validate(
    request: ValidateDimensionAssignmentsRequest,
  ): Promise<readonly AccountingDimensionAssignmentValidationIssue[]> {
    return this.database.transaction(async (session) => {
      const policies = await this.loadPolicies(session, request);
      const dimensionTypeIds = unique([
        ...policies.map((policy) => policy.dimensionTypeId),
        ...request.assignments.map((assignment) => assignment.dimensionTypeId),
      ]);
      const memberIds = unique(
        request.assignments.flatMap((assignment) => assignment.memberIds),
      );

      const [dimensionTypes, members] = await Promise.all([
        this.loadDimensionTypes(session, request.companyId, dimensionTypeIds),
        this.loadMembers(session, memberIds),
      ]);

      return validateAccountingDimensionAssignments({
        ...request,
        policies,
        dimensionTypes,
        members,
      });
    });
  }

  async assertValid(
    request: ValidateDimensionAssignmentsRequest,
  ): Promise<void> {
    const issues = await this.validate(request);

    if (issues.length > 0) {
      throw new AccountingDimensionAssignmentValidationError(issues);
    }
  }

  private async loadPolicies(
    session: DatabaseSession,
    request: ValidateDimensionAssignmentsRequest,
  ): Promise<readonly AccountDimensionPolicy[]> {
    const rows = await session.query<PolicyRow>(
      `SELECT *
       FROM account_dimension_policies
       WHERE company_id = ? AND account_id = ?
       ORDER BY dimension_type_id, id`,
      [request.companyId, request.accountId],
    );

    return rows.map(mapPolicyRow);
  }

  private async loadDimensionTypes(
    session: DatabaseSession,
    companyId: string,
    dimensionTypeIds: readonly string[],
  ): Promise<readonly AccountingDimensionType[]> {
    if (dimensionTypeIds.length === 0) return [];

    const rows = await session.query<DimensionTypeRow>(
      `SELECT *
       FROM accounting_dimension_types
       WHERE company_id = ? AND id IN (${placeholders(dimensionTypeIds)})
       ORDER BY id`,
      [companyId, ...dimensionTypeIds],
    );

    return rows.map(mapDimensionTypeRow);
  }

  private async loadMembers(
    session: DatabaseSession,
    memberIds: readonly string[],
  ): Promise<readonly AccountingDimensionMember[]> {
    if (memberIds.length === 0) return [];

    const rows = await session.query<MemberRow>(
      `SELECT *
       FROM accounting_dimension_members
       WHERE id IN (${placeholders(memberIds)})
       ORDER BY id`,
      memberIds,
    );

    return rows.map(mapMemberRow);
  }
}

function mapPolicyRow(row: PolicyRow): AccountDimensionPolicy {
  return Object.freeze({
    id: row.id,
    companyId: row.company_id,
    accountId: row.account_id,
    dimensionTypeId: row.dimension_type_id,
    requirement: row.requirement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

function mapDimensionTypeRow(row: DimensionTypeRow): AccountingDimensionType {
  return Object.freeze({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    englishName: row.english_name,
    hierarchical: row.hierarchical === 1,
    allowMultipleMembers: row.allow_multiple_members === 1,
    status: row.status,
    displayOrder: row.display_order,
    source: row.source,
    sourceReferenceId: row.source_reference_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

function mapMemberRow(row: MemberRow): AccountingDimensionMember {
  return Object.freeze({
    id: row.id,
    companyId: row.company_id,
    dimensionTypeId: row.dimension_type_id,
    code: row.code,
    name: row.name,
    englishName: row.english_name,
    parentId: row.parent_id,
    status: row.status,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    displayOrder: row.display_order,
    source: row.source,
    sourceReferenceId: row.source_reference_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}
