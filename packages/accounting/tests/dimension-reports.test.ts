import assert from "node:assert/strict";
import test from "node:test";
import type { Account } from "../src/domain/account.ts";
import type { AccountingDimensionMember } from "../src/domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "../src/domain/accounting-dimension-type.ts";
import { createAccountingDimensionReports } from "../src/dimension-reports.ts";
import { normalizeAccountingReportQuery } from "../src/reporting.ts";
import type { AccountingReportJournalLineFact } from "../src/reporting-balance.ts";

const account = (id:string,parentId:string|null,postingAllowed:boolean):Account => ({id,companyId:"c1",parentId,level:postingAllowed?"subsidiary":parentId?"general":"group",code:id as Account["code"],name:id as Account["name"],englishName:null,nature:"uncontrolled",normalBalance:"debit",statementType:"balance_sheet",reportClassification:{} as Account["reportClassification"],postingAllowed,currencyEnabled:false,revaluationEnabled:false,trackingEnabled:false,dueDateEnabled:false,status:"active",displayOrder:0,sourceType:"manual",sourceReferenceId:null,createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",version:1});
const types:AccountingDimensionType[]=[{id:"project",companyId:"c1",code:"PRJ",name:"Project",englishName:null,hierarchical:true,allowMultipleMembers:false,status:"active",displayOrder:0,source:"manual",sourceReferenceId:null,createdAt:"2026-01-01",updatedAt:"2026-01-01",version:1}];
const members:AccountingDimensionMember[]=[{id:"p1",companyId:"c1",dimensionTypeId:"project",code:"P1",name:"Project 1",englishName:null,parentId:null,status:"active",validFrom:null,validTo:null,displayOrder:0,source:"manual",sourceReferenceId:null,createdAt:"2026-01-01",updatedAt:"2026-01-01",version:1}];
const accounts=[account("g",null,false),account("cash","g",true),account("sales","g",true)];
const fact=(id:string,accountId:string,date:string,debit:number,credit:number,posted=true):AccountingReportJournalLineFact=>({companyId:"c1",currency:"IRR",branchId:"b1",fiscalYearId:"fy",fiscalPeriodId:"fp",voucherId:`v${id}`,journalLineId:id,voucherDate:date,accountId,debit,credit,isPostedFact:posted,dimensions:[{dimensionTypeId:"project",memberId:"p1"}]});
const q=()=>normalizeAccountingReportQuery({companyId:"c1",period:{fromDate:"2026-04-01",toDate:"2026-04-30"}});

test("aggregates opening, turnover and ending by dimension member and account member",()=>{
 const r=createAccountingDimensionReports(q(),accounts,types,members,[fact("1","cash","2026-03-20",100,0),fact("2","cash","2026-04-05",50,0),fact("3","sales","2026-04-06",0,50)]);
 assert.equal(r.byMember.length,1); assert.equal(r.byMember[0]!.openingNet,100); assert.equal(r.byMember[0]!.periodDebit,50); assert.equal(r.byMember[0]!.periodCredit,50); assert.equal(r.byMember[0]!.endingNet,100);
 assert.equal(r.byAccountMember.length,2);
});

test("inherits posted scope and account hierarchy selection",()=>{
 const query=normalizeAccountingReportQuery({companyId:"c1",period:{fromDate:"2026-04-01",toDate:"2026-04-30"},accounts:{accountId:"g",includeDescendants:true}});
 const r=createAccountingDimensionReports(query,accounts,types,members,[fact("1","cash","2026-04-05",10,0),fact("2","sales","2026-04-06",0,10,false)]);
 assert.equal(r.byMember[0]!.periodDebit,10); assert.equal(r.byMember[0]!.periodCredit,0); assert.equal(r.byAccountMember.length,1);
});

test("rejects mismatched dimension metadata",()=>{
 assert.throws(()=>createAccountingDimensionReports(q(),accounts,types,members,[{...fact("1","cash","2026-04-05",10,0),dimensions:[{dimensionTypeId:"project",memberId:"missing"}]}]),/اطلاعات نوع یا عضو/);
});
