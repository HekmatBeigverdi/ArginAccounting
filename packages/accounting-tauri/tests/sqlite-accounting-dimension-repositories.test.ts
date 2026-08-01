import assert from "node:assert/strict";
import test from "node:test";
import { createAccountDimensionPolicy, createAccountingDimensionMember, createAccountingDimensionType } from "@argin/accounting";
import type { DatabaseExecutor, DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteAccountDimensionPolicyRepository, SqliteAccountingDimensionMemberRepository, SqliteAccountingDimensionTypeRepository, SqliteAccountingUnitOfWork } from "../src/index.ts";

class FakeDatabase implements DatabaseSession {
  readonly executions: Array<{sql:string;parameters:readonly DatabaseValue[]}> = [];
  readonly queries: Array<{sql:string;parameters:readonly DatabaseValue[]}> = [];
  rowsAffected=1; queryRows:unknown[]=[]; queryOneRows:unknown[]=[];
  async execute(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<DatabaseExecuteResult>{this.executions.push({sql,parameters});return{rowsAffected:this.rowsAffected};}
  async query<T>(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<T[]>{this.queries.push({sql,parameters});return this.queryRows as T[];}
  async queryOne<T>(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<T|null>{this.queries.push({sql,parameters});return (this.queryOneRows.shift()??null) as T|null;}
}
class FakeExecutor extends FakeDatabase implements DatabaseExecutor { transactionRuns=0; async transaction<T>(op:(s:DatabaseSession)=>Promise<T>){this.transactionRuns++;return op(this);} async close(){} }
const now="2026-08-01T00:00:00.000Z";
const type=()=>createAccountingDimensionType({id:"type-1",companyId:"company-1",code:"PROJECT",name:"پروژه",hierarchical:true,createdAt:now});
const member=()=>createAccountingDimensionMember({id:"member-1",companyId:"company-1",dimensionTypeId:"type-1",code:"P-01",name:"پروژه یک",validFrom:"2026-01-01",createdAt:now});
const policy=()=>createAccountDimensionPolicy({id:"policy-1",companyId:"company-1",accountId:"account-1",dimensionTypeId:"type-1",requirement:"required",createdAt:now});

test("dimension repositories persist every aggregate",async()=>{const db=new FakeDatabase();await new SqliteAccountingDimensionTypeRepository(db).create(type());await new SqliteAccountingDimensionMemberRepository(db).create(member());await new SqliteAccountDimensionPolicyRepository(db).create(policy());assert.match(db.executions[0]!.sql,/INSERT INTO accounting_dimension_types/);assert.match(db.executions[1]!.sql,/INSERT INTO accounting_dimension_members/);assert.match(db.executions[2]!.sql,/INSERT INTO account_dimension_policies/);});

test("dimension type maps SQLite booleans",async()=>{const db=new FakeDatabase();db.queryOneRows=[{id:"type-1",company_id:"company-1",code:"PROJECT",name:"پروژه",english_name:null,hierarchical:1,allow_multiple_members:0,status:"active",display_order:0,source:"manual",source_reference_id:null,created_at:now,updated_at:now,version:1}];const value=await new SqliteAccountingDimensionTypeRepository(db).findById("type-1");assert.equal(value?.hierarchical,true);assert.equal(value?.allowMultipleMembers,false);});

test("member search applies company, type, status, validity, stable order and paging",async()=>{const db=new FakeDatabase();db.queryOneRows=[{total:2}];await new SqliteAccountingDimensionMemberRepository(db).search({companyId:"company-1",dimensionTypeId:"type-1",status:"active",effectiveOn:"2026-08-01",pagination:{page:2,pageSize:1},sorts:[{field:"code",direction:"descending"}]});assert.match(db.queries[0]!.sql,/COUNT\(\*\).*company_id = \?.*dimension_type_id = \?.*valid_from IS NULL/s);assert.match(db.queries[1]!.sql,/ORDER BY code DESC, id ASC LIMIT \? OFFSET \?/);assert.deepEqual(db.queries[1]!.parameters,["company-1","type-1","active","2026-08-01","2026-08-01",1,1]);});

test("policy search returns complete paging metadata",async()=>{const db=new FakeDatabase();db.queryOneRows=[{total:3}];const result=await new SqliteAccountDimensionPolicyRepository(db).search({companyId:"company-1",accountId:"account-1",pagination:{page:1,pageSize:2}});assert.equal(result.totalPages,2);assert.equal(result.hasNextPage,true);assert.equal(result.totalItems,3);});

test("dimension update enforces optimistic concurrency",async()=>{const db=new FakeDatabase();db.rowsAffected=0;await assert.rejects(new SqliteAccountingDimensionMemberRepository(db).update({...member(),version:2}),{name:"ConcurrencyConflictError"});});

test("unit of work exposes all dimension repositories in one transaction",async()=>{const db=new FakeExecutor();await new SqliteAccountingUnitOfWork(db).run(async r=>{assert.ok(r.dimensionTypes);assert.ok(r.dimensionMembers);assert.ok(r.dimensionPolicies);await r.dimensionTypes.create(type());await r.dimensionMembers.create(member());await r.dimensionPolicies.create(policy());});assert.equal(db.transactionRuns,1);assert.equal(db.executions.length,3);});
