import type {
  CreateHistoricalLockInput,
  HistoricalLock,
  HistoricalLockRepository,
  HistoricalLockScope
} from "@argin/fiscal";

import type {
  DatabaseSession
} from "@argin/database";

interface HistoricalLockRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  scope: HistoricalLockScope;
  locked_through_date: string;
  reason: string;
  is_active: number;
  created_by: string | null;
  created_at: string;
  released_by: string | null;
  released_at: string | null;
}

function mapHistoricalLock(
  row: HistoricalLockRow
): HistoricalLock {
  return {
    id: row.id,
    companyId: row.company_id,
    branchId: row.branch_id,
    scope: row.scope,
    lockedThroughDate: row.locked_through_date,
    reason: row.reason,
    isActive: row.is_active === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    releasedBy: row.released_by,
    releasedAt: row.released_at
  };
}

export class SqliteHistoricalLockRepository
  implements HistoricalLockRepository {
  constructor(
    private readonly database: DatabaseSession
  ) {}

  async create(
    input: CreateHistoricalLockInput
  ): Promise<HistoricalLock> {
    const lock: HistoricalLock = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      scope: input.scope,
      lockedThroughDate: input.lockedThroughDate,
      reason: input.reason,
      isActive: true,
      createdBy: input.createdBy ?? null,
      createdAt: new Date().toISOString(),
      releasedBy: null,
      releasedAt: null
    };

    await this.database.execute(
      `
        INSERT INTO historical_locks (
          id,
          company_id,
          branch_id,
          scope,
          locked_through_date,
          reason,
          is_active,
          created_by,
          created_at,
          released_by,
          released_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        lock.id,
        lock.companyId,
        lock.branchId,
        lock.scope,
        lock.lockedThroughDate,
        lock.reason,
        lock.isActive,
        lock.createdBy,
        lock.createdAt,
        lock.releasedBy,
        lock.releasedAt
      ]
    );

    return lock;
  }

  async findActiveLocks(
    companyId: string,
    branchId: string | null,
    scope: HistoricalLockScope
  ): Promise<HistoricalLock[]> {
    const rows =
      await this.database.query<HistoricalLockRow>(
        `
          SELECT *
          FROM historical_locks
          WHERE company_id = ?
            AND is_active = 1
            AND (
              branch_id IS NULL
              OR branch_id = ?
            )
            AND (
              scope = 'all'
              OR scope = ?
            )
          ORDER BY locked_through_date DESC
        `,
        [
          companyId,
          branchId,
          scope
        ]
      );

    return rows.map(mapHistoricalLock);
  }

  async release(
    lockId: string,
    releasedBy: string | null,
    releasedAt: string
  ): Promise<void> {
    await this.database.execute(
      `
        UPDATE historical_locks
        SET
          is_active = 0,
          released_by = ?,
          released_at = ?
        WHERE id = ?
      `,
      [
        releasedBy,
        releasedAt,
        lockId
      ]
    );
  }
}
