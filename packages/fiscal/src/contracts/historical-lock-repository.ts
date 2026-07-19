import type {
  CreateHistoricalLockInput,
  HistoricalLock,
  HistoricalLockScope
} from "../domain/historical-lock";

export interface HistoricalLockRepository {
  create(
    input: CreateHistoricalLockInput
  ): Promise<HistoricalLock>;

  findActiveLocks(
    companyId: string,
    branchId: string | null,
    scope: HistoricalLockScope
  ): Promise<HistoricalLock[]>;

  release(
    lockId: string,
    releasedBy: string | null,
    releasedAt: string
  ): Promise<void>;
}
