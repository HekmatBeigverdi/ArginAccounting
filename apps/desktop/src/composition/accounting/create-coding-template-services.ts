import {
  applyCodingTemplate,
  BUILT_IN_IRANIAN_CODING_CATALOGS,
  codingTemplatePermissions,
  createCodingTemplatePreview,
  createCodingTemplateDraft,
  createCodingTemplateUpgradePlan,
  importCodingTemplateWorkbook,
  previewCodingTemplateWorkbookImport,
  publishCodingTemplateCommand,
  retireCodingTemplateCommand,
  type CodingTemplate,
  type CodingTemplateApplicationHistory,
  type CodingTemplateAuthorizer,
  type CodingTemplatePreviewPlan,
  type CodingTemplateUpgradePlan,
  type CodingTemplateVersionRecord,
  type CodingTemplateWorkbookImportPreview,
} from "@argin/accounting";
import {
  SqliteAccountingUnitOfWork,
  WebCryptoCodingTemplateWorkbookFingerprintProvider,
  XlsxCodingTemplateWorkbookParser,
} from "@argin/accounting-tauri";
import type { Company } from "@argin/company";
import type { DatabaseExecutor } from "@argin/database";
import type { Clock, EventBus, IdGenerator } from "@argin/platform";

export interface CodingTemplateServices {
  searchTemplates(text?: string): Promise<readonly CodingTemplate[]>;
  searchVersions(templateId: string): Promise<readonly CodingTemplateVersionRecord[]>;
  recommend(company: Company): Promise<readonly CodingTemplate[]>;
  preview(companyId: string, versionId: string): Promise<CodingTemplatePreviewPlan>;
  apply(input: { companyId: string; templateId: string; versionId: string; baselineFingerprint: string }): Promise<void>;
  history(companyId: string): Promise<readonly CodingTemplateApplicationHistory[]>;
  previewUpgrade(companyId: string, applicationId: string, targetVersionId: string): Promise<CodingTemplateUpgradePlan>;
  previewWorkbook(file: File): Promise<CodingTemplateWorkbookImportPreview>;
  importWorkbook(file: File, fingerprint: string): Promise<void>;
  retire(template: CodingTemplate): Promise<void>;
}

interface Dependencies {
  database: DatabaseExecutor;
  clock: Clock;
  idGenerator: IdGenerator;
  eventBus: EventBus;
  authorizer: CodingTemplateAuthorizer;
  actorId: string;
}

export function createCodingTemplateServices(deps: Dependencies): CodingTemplateServices {
  const unitOfWork = new SqliteAccountingUnitOfWork(deps.database);
  const parser = new XlsxCodingTemplateWorkbookParser();
  const fingerprintProvider = new WebCryptoCodingTemplateWorkbookFingerprintProvider();
  const runtime = {
    unitOfWork,
    authorizer: deps.authorizer,
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    eventPublisher: deps.eventBus,
    parser,
    fingerprintProvider,
  };
  const systemRuntime = {
    ...runtime,
    authorizer: { hasPermission: async (permission: string) => permission === "system.full-access" },
  };
  const source = async (file: File) => ({ fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  let builtInsReady: Promise<void> | null = null;
  const ensureBuiltIns = () => builtInsReady ??= (async () => {
    for (const catalog of BUILT_IN_IRANIAN_CODING_CATALOGS) {
      const existing = await unitOfWork.run((r) => required(r.codingTemplates).findByCode(catalog.templateCode));
      if (existing) continue;
      const draft = await createCodingTemplateDraft({
        code: catalog.templateCode, persianName: catalog.persianName, englishName: catalog.englishName,
        activityType: catalog.activityType, ownership: "built_in", actorId: "desktop-catalog-bootstrap",
      }, systemRuntime);
      const bytes = new TextEncoder().encode(JSON.stringify(catalog.content));
      const fingerprint = await fingerprintProvider.sha256(bytes);
      await publishCodingTemplateCommand({
        templateId: String(draft.id), expectedOptimisticVersion: draft.optimisticVersion,
        content: catalog.content, actorId: "desktop-catalog-bootstrap",
        source: { type: "catalog", reference: catalog.templateCode, contractVersion: catalog.contractVersion, contentFingerprint: fingerprint },
      }, systemRuntime);
    }
  })().catch((error) => { builtInsReady = null; throw error; });

  return {
    async searchTemplates(text) {
      await ensureBuiltIns();
      return unitOfWork.run(async (r) => (await required(r.codingTemplates).search({
        ...(text?.trim() ? { text } : {}), pagination: { page: 1, pageSize: 200 },
      })).items);
    },
    async searchVersions(templateId) {
      return unitOfWork.run(async (r) => (await required(r.codingTemplateVersions).search({
        templateId, pagination: { page: 1, pageSize: 100 },
      })).items);
    },
    async recommend(company) {
      const values = await this.searchTemplates();
      return values.filter((item) => item.lifecycle === "published" && item.activityType === company.activityType);
    },
    async preview(companyId, versionId) {
      return unitOfWork.run(async (r) => {
        const version = await required(r.codingTemplateVersions).findById(versionId);
        if (!version) throw new Error("coding-template-version-not-found");
        const baseline = await required(r.codingTemplateBaselines).read(companyId);
        return createCodingTemplatePreview({ companyId, templateVersionId: versionId, content: version.content, baseline });
      });
    },
    async apply(input) {
      await applyCodingTemplate({
        companyId: input.companyId, templateId: input.templateId,
        templateVersionId: input.versionId, baselineFingerprint: input.baselineFingerprint,
        requestKey: crypto.randomUUID(), confirmed: true, actorId: deps.actorId,
      }, runtime);
    },
    async history(companyId) {
      return unitOfWork.run(async (r) => (await required(r.codingTemplateApplications).search({
        companyId, pagination: { page: 1, pageSize: 100 },
      })).items);
    },
    async previewUpgrade(companyId, applicationId, targetVersionId) {
      return unitOfWork.run(async (r) => {
        const applications = required(r.codingTemplateApplications);
        const versions = required(r.codingTemplateVersions);
        const application = await applications.findById(applicationId);
        if (!application) throw new Error("coding-template-application-not-found");
        const [from, to, baseline, mappings] = await Promise.all([
          versions.findById(application.templateVersionId), versions.findById(targetVersionId),
          required(r.codingTemplateBaselines).read(companyId),
          required(r.codingTemplateApplicationMappings).findByApplicationId(applicationId),
        ]);
        if (!from || !to) throw new Error("coding-template-version-not-found");
        return createCodingTemplateUpgradePlan({
          companyId, templateId: application.templateId,
          fromVersionId: String(from.version.id), fromVersionNumber: Number(from.version.versionNumber), fromContent: from.content,
          toTemplateId: String(to.version.templateId), toVersionId: String(to.version.id),
          toVersionNumber: Number(to.version.versionNumber), toContent: to.content, baseline, appliedMappings: mappings,
        });
      });
    },
    async previewWorkbook(file) {
      return previewCodingTemplateWorkbookImport(await source(file), { parser, fingerprintProvider });
    },
    async importWorkbook(file, fingerprint) {
      await importCodingTemplateWorkbook({
        source: await source(file), importKey: crypto.randomUUID(), expectedFileFingerprint: fingerprint,
        confirmed: true, actorId: deps.actorId,
      }, runtime);
    },
    async retire(template) {
      await retireCodingTemplateCommand({
        templateId: String(template.id), expectedOptimisticVersion: template.optimisticVersion, actorId: deps.actorId,
      }, runtime);
    },
  };
}

function required<T>(value: T | null | undefined): T {
  if (!value) throw new Error("coding-template-repository-unavailable");
  return value;
}

export { codingTemplatePermissions };
