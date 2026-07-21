import type {
  Branch,
  BranchRepository,
  CreateBranchInput
} from "@argin/company";

import type {
  DatabaseExecutor
} from "@argin/database";

interface BranchRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  is_head_office: number;
  status: Branch["status"];
  created_at: string;
  updated_at: string;
}

function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    isHeadOffice: row.is_head_office === 1,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteBranchRepository
  implements BranchRepository {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async create(
    input: CreateBranchInput
  ): Promise<Branch> {
    const now = new Date().toISOString();

    const branch: Branch = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      isHeadOffice: input.isHeadOffice,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO branches (
          id,
          company_id,
          code,
          name,
          is_head_office,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch.id,
        branch.companyId,
        branch.code,
        branch.name,
        branch.isHeadOffice ? 1 : 0,
        branch.status,
        branch.createdAt,
        branch.updatedAt
      ]
    );

    return branch;
  }

  async findById(id: string): Promise<Branch | null> {
    const row = await this.database.queryOne<BranchRow>(
      "SELECT * FROM branches WHERE id = ?",
      [id]
    );

    return row ? mapBranch(row) : null;
  }

  async findByCompanyId(
    companyId: string
  ): Promise<Branch[]> {
    const rows = await this.database.query<BranchRow>(
      `
        SELECT *
        FROM branches
        WHERE company_id = ?
        ORDER BY is_head_office DESC, name
      `,
      [companyId]
    );

    return rows.map(mapBranch);
  }

  async findAll(): Promise<Branch[]> {
    const rows =
      await this.database.query<BranchRow>(
        `
          SELECT *
          FROM branches
          ORDER BY
            is_head_office DESC,
            name
        `
      );

    return rows.map(mapBranch);
  }

  async findHeadOffice(
    companyId: string
  ): Promise<Branch | null> {
    const row = await this.database.queryOne<BranchRow>(
      `
        SELECT *
        FROM branches
        WHERE company_id = ?
          AND is_head_office = 1
      `,
      [companyId]
    );

    return row ? mapBranch(row) : null;
  }

  async update(branch: Branch): Promise<void> {
    await this.database.execute(
      `
        UPDATE branches
        SET
          code = ?,
          name = ?,
          is_head_office = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        branch.code,
        branch.name,
        branch.isHeadOffice ? 1 : 0,
        branch.status,
        branch.updatedAt,
        branch.id
      ]
    );
  }
}
