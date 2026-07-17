import type {
  Branch,
  CreateBranchInput
} from "../domain/branch";

export interface BranchRepository {
  create(input: CreateBranchInput): Promise<Branch>;

  findById(id: string): Promise<Branch | null>;

  findByCompanyId(companyId: string): Promise<Branch[]>;

  findHeadOffice(companyId: string): Promise<Branch | null>;

  update(branch: Branch): Promise<void>;
}
