import {
  normalizeAccountingDimensionTypeSearchQuery,
  type AccountingDimensionType,
  type AccountingDimensionTypeRepository,
  type AccountingDimensionTypeSearchQuery,
  type AccountingDimensionTypeSortField,
} from "@argin/accounting";
import { assertVersionedUpdate, type DatabaseSession } from "@argin/database";
import { queryPage, sqlOrderBy } from "./sqlite-dimension-query.ts";

interface Row { id:string; company_id:string; code:string; name:string; english_name:string|null; hierarchical:number; allow_multiple_members:number; status:AccountingDimensionType["status"]; display_order:number; source:AccountingDimensionType["source"]; source_reference_id:string|null; created_at:string; updated_at:string; version:number }
const columns: Record<AccountingDimensionTypeSortField,string> = { displayOrder:"display_order", code:"code", name:"name", createdAt:"created_at", id:"id" };
const map = (r: Row): AccountingDimensionType => Object.freeze({ id:r.id, companyId:r.company_id, code:r.code, name:r.name, englishName:r.english_name, hierarchical:r.hierarchical===1, allowMultipleMembers:r.allow_multiple_members===1, status:r.status, displayOrder:r.display_order, source:r.source, sourceReferenceId:r.source_reference_id, createdAt:r.created_at, updatedAt:r.updated_at, version:r.version });

export class SqliteAccountingDimensionTypeRepository implements AccountingDimensionTypeRepository {
  constructor(private readonly database: DatabaseSession) {}
  async create(v: AccountingDimensionType): Promise<void> { await this.database.execute(`INSERT INTO accounting_dimension_types (id, company_id, code, name, english_name, hierarchical, allow_multiple_members, status, display_order, source, source_reference_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, this.params(v)); }
  async findById(id:string) { const r=await this.database.queryOne<Row>(`SELECT * FROM accounting_dimension_types WHERE id = ?`,[id]); return r?map(r):null; }
  async findByCode(companyId:string,code:string) { const r=await this.database.queryOne<Row>(`SELECT * FROM accounting_dimension_types WHERE company_id = ? AND code = ? COLLATE NOCASE`,[companyId,code]); return r?map(r):null; }
  async search(input: AccountingDimensionTypeSearchQuery) { const q=normalizeAccountingDimensionTypeSearchQuery(input); const w=["company_id = ?"], p:(string|number|null)[]=[q.companyId]; if(q.status){w.push("status = ?");p.push(q.status);} if(q.text){w.push("(code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR english_name LIKE ? ESCAPE '\\')"); const x=`%${escapeLike(q.text)}%`;p.push(x,x,x);} return queryPage<Row,AccountingDimensionType>(this.database,"accounting_dimension_types",w,p,sqlOrderBy(q.sorts,columns),q.pagination,map); }
  async update(v: AccountingDimensionType): Promise<void> { const x=await this.database.execute(`UPDATE accounting_dimension_types SET code=?, name=?, english_name=?, hierarchical=?, allow_multiple_members=?, status=?, display_order=?, source=?, source_reference_id=?, updated_at=?, version=? WHERE id=? AND company_id=? AND version=?`,[v.code,v.name,v.englishName,v.hierarchical?1:0,v.allowMultipleMembers?1:0,v.status,v.displayOrder,v.source,v.sourceReferenceId,v.updatedAt,v.version,v.id,v.companyId,v.version-1]); assertVersionedUpdate(x,{entityType:"AccountingDimensionType",entityId:v.id,expectedVersion:v.version-1}); }
  async delete(v: AccountingDimensionType): Promise<void> { const x=await this.database.execute(`DELETE FROM accounting_dimension_types WHERE id=? AND company_id=? AND version=?`,[v.id,v.companyId,v.version]); assertVersionedUpdate(x,{entityType:"AccountingDimensionType",entityId:v.id,expectedVersion:v.version}); }
  private params(v:AccountingDimensionType){return [v.id,v.companyId,v.code,v.name,v.englishName,v.hierarchical?1:0,v.allowMultipleMembers?1:0,v.status,v.displayOrder,v.source,v.sourceReferenceId,v.createdAt,v.updatedAt,v.version];}
}
function escapeLike(v:string){return v.replace(/[\\%_]/g,"\\$&");}
