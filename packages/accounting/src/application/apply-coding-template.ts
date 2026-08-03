import { createDomainEvent, type CorrelationContext, type DomainEvent } from "@argin/platform";
import type {
  AccountingUnitOfWork,
  AccountingUnitOfWorkRepositories,
} from "../contracts/accounting-unit-of-work.ts";
import type {
  CodingTemplateApplicationHistory,
  CodingTemplateApplicationItemMapping,
} from "../contracts/coding-template-records.ts";
import type {
  CodingTemplateAuthorizer,
  CodingTemplateClock,
  CodingTemplateEventPublisher,
  CodingTemplateIdentifierGenerator,
} from "../contracts/coding-template-runtime.ts";
import { createAccount } from "../domain/create-account.ts";
import { createAccountDimensionPolicy } from "../domain/create-account-dimension-policy.ts";
import { createAccountingDimensionMember } from "../domain/create-accounting-dimension-member.ts";
import { createAccountingDimensionType } from "../domain/create-accounting-dimension-type.ts";
import { createCodingTemplatePreview } from "./coding-template-preview.ts";
import { CodingTemplateApplicationError } from "./coding-template-application-error.ts";
import { codingTemplatePermissions } from "./coding-template-permissions.ts";

export const APPLY_CODING_TEMPLATE_PERMISSION = codingTemplatePermissions.apply;

export interface ApplyCodingTemplateCommand {
  readonly companyId: string;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly baselineFingerprint: string;
  readonly requestKey: string;
  readonly confirmed: boolean;
  readonly actorId: string;
  readonly correlation?: CorrelationContext;
}

export interface ApplyCodingTemplateResult {
  readonly application: CodingTemplateApplicationHistory;
  readonly mappings: readonly CodingTemplateApplicationItemMapping[];
  readonly idempotentReplay: boolean;
}

export interface ApplyCodingTemplateDependencies {
  readonly unitOfWork: AccountingUnitOfWork;
  readonly authorizer: CodingTemplateAuthorizer;
  readonly clock: CodingTemplateClock;
  readonly idGenerator: CodingTemplateIdentifierGenerator;
  readonly eventPublisher: CodingTemplateEventPublisher;
}

const required = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new CodingTemplateApplicationError("invalid_identifier", field);
  }
  return normalized;
};

const repositories = (all: AccountingUnitOfWorkRepositories) => {
  const {
    accounts,
    dimensionTypes,
    dimensionMembers,
    dimensionPolicies,
    codingTemplates: templates,
    codingTemplateVersions: versions,
    codingTemplateApplications: applications,
    codingTemplateApplicationMappings: mappings,
    codingTemplateBaselines: baselines,
  } = all;

  if (
    !dimensionTypes ||
    !dimensionMembers ||
    !dimensionPolicies ||
    !templates ||
    !versions ||
    !applications ||
    !mappings ||
    !baselines
  ) {
    throw new CodingTemplateApplicationError("repository_unavailable", null);
  }

  return {
    accounts,
    dimensionTypes,
    dimensionMembers,
    dimensionPolicies,
    templates,
    versions,
    applications,
    mappings,
    baselines,
  };
};

export async function applyCodingTemplate(
  command: ApplyCodingTemplateCommand,
  dependencies: ApplyCodingTemplateDependencies,
): Promise<ApplyCodingTemplateResult> {
  const companyId = required(command.companyId, "companyId");
  const templateId = required(command.templateId, "templateId");
  const templateVersionId = required(command.templateVersionId, "templateVersionId");
  const requestKey = required(command.requestKey, "requestKey");
  const actorId = required(command.actorId, "actorId");
  const expectedFingerprint = required(command.baselineFingerprint, "baselineFingerprint");
  if (!command.confirmed) {
    throw new CodingTemplateApplicationError("confirmation_required", "confirmed");
  }
  if (!await dependencies.authorizer.hasPermission(APPLY_CODING_TEMPLATE_PERMISSION)) {
    throw new CodingTemplateApplicationError("permission_denied", null);
  }

  let event: DomainEvent | null = null;
  const result = await dependencies.unitOfWork.run(async (all) => {
    const r = repositories(all);
    const previous = await r.applications.findByRequestKey(companyId, requestKey);
    if (previous) {
      const requestMatches =
        previous.templateId === templateId &&
        previous.templateVersionId === templateVersionId &&
        previous.status === "applied";
      if (!requestMatches) {
        throw new CodingTemplateApplicationError("request_key_reused", "requestKey");
      }
      return {
        application: previous,
        mappings: await r.mappings.findByApplicationId(previous.id),
        idempotentReplay: true,
      };
    }

    const template = await r.templates.findById(templateId);
    if (!template) {
      throw new CodingTemplateApplicationError("template_not_found", "templateId");
    }
    if (template.lifecycle !== "published") {
      throw new CodingTemplateApplicationError("template_not_published", "templateId");
    }

    const record = await r.versions.findById(templateVersionId);
    if (!record || record.version.templateId !== template.id) {
      throw new CodingTemplateApplicationError("version_not_found", "templateVersionId");
    }

    const baseline = await r.baselines.read(companyId);
    const preview = createCodingTemplatePreview({
      companyId,
      templateVersionId,
      content: record.content,
      baseline,
    });
    if (preview.baselineFingerprint !== expectedFingerprint) {
      throw new CodingTemplateApplicationError("stale_preview", "baselineFingerprint");
    }
    if (!preview.canApply) {
      throw new CodingTemplateApplicationError("preview_not_applicable", null);
    }

    const now = dependencies.clock.now().toISOString();
    const applicationId = dependencies.idGenerator.generate();
    const operationalIds = new Map<string, string>();
    const mappings: CodingTemplateApplicationItemMapping[] = [];
    const planByKey = new Map(
      preview.items.map((item) => [`${item.itemType}:${item.logicalKey}`, item]),
    );
    const addMapping = (
      itemType: CodingTemplateApplicationItemMapping["itemType"],
      logicalKey: string,
      operationalId: string,
      action: CodingTemplateApplicationItemMapping["action"],
    ) => {
      operationalIds.set(`${itemType}:${logicalKey}`, operationalId);
      mappings.push(Object.freeze({
        applicationId,
        companyId,
        templateVersionId,
        itemType,
        logicalKey,
        operationalId,
        action,
      }));
    };

    for (const item of record.content.accounts) {
      const plan = planByKey.get(`account:${item.logicalKey}`)!;
      if (plan.action === "compatible_existing") {
        addMapping("account", item.logicalKey, plan.existingId!, "matched");
        continue;
      }

      const parentId = item.parentLogicalKey
        ? operationalIds.get(`account:${item.parentLogicalKey}`) ?? null
        : null;
      const account = createAccount({
        id: dependencies.idGenerator.generate(),
        companyId,
        parentId,
        level: item.level,
        code: item.code,
        name: item.persianName,
        englishName: item.englishName,
        nature: item.nature,
        normalBalance: item.normalBalance,
        statementType: item.statementType,
        reportClassification: item.reportClassification,
        postingAllowed: item.postingAllowed,
        currencyEnabled: item.currencyEnabled,
        revaluationEnabled: item.revaluationEnabled,
        trackingEnabled: item.trackingEnabled,
        dueDateEnabled: item.dueDateEnabled,
        status: item.activeByDefault ? "active" : "inactive",
        displayOrder: item.displayOrder,
        sourceType: "coding_template",
        sourceReferenceId: `${templateVersionId}:${item.logicalKey}`,
        createdAt: now,
      });
      await r.accounts.create(account);
      addMapping("account", item.logicalKey, account.id, "created");
    }

    for (const item of record.content.dimensionTypes) {
      const plan = planByKey.get(`dimension_type:${item.logicalKey}`)!;
      if (plan.action === "compatible_existing") {
        addMapping("dimension_type", item.logicalKey, plan.existingId!, "matched");
        continue;
      }

      const dimension = createAccountingDimensionType({
        id: dependencies.idGenerator.generate(),
        companyId,
        code: item.code,
        name: item.persianName,
        englishName: item.englishName,
        hierarchical: item.hierarchical,
        allowMultipleMembers: item.allowMultipleMembers,
        status: item.activeByDefault ? "active" : "inactive",
        displayOrder: item.displayOrder,
        source: "system",
        sourceReferenceId: `${templateVersionId}:${item.logicalKey}`,
        createdAt: now,
      });
      await r.dimensionTypes.create(dimension);
      addMapping("dimension_type", item.logicalKey, dimension.id, "created");
    }

    for (const item of record.content.dimensionMembers) {
      const plan = planByKey.get(`dimension_member:${item.logicalKey}`)!;
      if (plan.action === "compatible_existing") {
        addMapping("dimension_member", item.logicalKey, plan.existingId!, "matched");
        continue;
      }

      const parentId = item.parentLogicalKey
        ? operationalIds.get(`dimension_member:${item.parentLogicalKey}`) ?? null
        : null;
      const member = createAccountingDimensionMember({
        id: dependencies.idGenerator.generate(),
        companyId,
        dimensionTypeId: operationalIds.get(
          `dimension_type:${item.dimensionTypeLogicalKey}`,
        )!,
        code: item.code,
        name: item.persianName,
        englishName: item.englishName,
        parentId,
        status: item.activeByDefault ? "active" : "inactive",
        displayOrder: item.displayOrder,
        source: "system",
        sourceReferenceId: `${templateVersionId}:${item.logicalKey}`,
        createdAt: now,
      });
      await r.dimensionMembers.create(member);
      addMapping("dimension_member", item.logicalKey, member.id, "created");
    }

    for (const item of record.content.accountDimensionPolicies) {
      const logicalKey = `${item.accountLogicalKey}:${item.dimensionTypeLogicalKey}`;
      const plan = planByKey.get(`account_dimension_policy:${logicalKey}`)!;
      if (plan.action === "compatible_existing") {
        addMapping(
          "account_dimension_policy",
          logicalKey,
          plan.existingId!,
          "matched",
        );
        continue;
      }

      const policy = createAccountDimensionPolicy({
        id: dependencies.idGenerator.generate(),
        companyId,
        accountId: operationalIds.get(`account:${item.accountLogicalKey}`)!,
        dimensionTypeId: operationalIds.get(
          `dimension_type:${item.dimensionTypeLogicalKey}`,
        )!,
        requirement: item.requirement,
        createdAt: now,
      });
      await r.dimensionPolicies.create(policy);
      addMapping("account_dimension_policy", logicalKey, policy.id, "created");
    }

    const application: CodingTemplateApplicationHistory = Object.freeze({
      id: applicationId,
      companyId,
      templateId,
      templateVersionId,
      requestKey,
      status: "applied",
      baselineFingerprint: expectedFingerprint,
      appliedAt: now,
      actorId,
      createdAt: now,
    });
    await r.mappings.createMany(Object.freeze(mappings));
    await r.applications.create(application);
    event = createApplicationEvent(dependencies, command, application, mappings);
    return {
      application,
      mappings: Object.freeze(mappings),
      idempotentReplay: false,
    };
  });

  if (event) {
    await dependencies.eventPublisher.publish(event);
  }
  return result;
}

function createApplicationEvent(
  dependencies: Pick<ApplyCodingTemplateDependencies, "clock" | "idGenerator">,
  command: ApplyCodingTemplateCommand,
  application: CodingTemplateApplicationHistory,
  mappings: readonly CodingTemplateApplicationItemMapping[],
): DomainEvent {
  const clock = {
    now: () => dependencies.clock.now(),
    nowIso: () => dependencies.clock.now().toISOString(),
  };
  const correlation = command.correlation
    ? { correlationContext: command.correlation }
    : {};

  return createDomainEvent(
    { clock, idGenerator: dependencies.idGenerator },
    {
      eventType: "accounting.coding-template.applied",
      aggregateId: application.id,
      aggregateType: "coding-template-application",
      aggregateVersion: 1,
      ...correlation,
      payload: Object.freeze({
        companyId: application.companyId,
        actorId: application.actorId,
        requestKey: application.requestKey,
        templateId: application.templateId,
        templateVersionId: application.templateVersionId,
        applicationId: application.id,
        source: "coding-template",
        before: Object.freeze({
          baselineFingerprint: application.baselineFingerprint,
        }),
        after: Object.freeze({
          status: application.status,
          mappingCount: mappings.length,
        }),
      }),
      metadata: Object.freeze({ module: "accounting", audit: true }),
    },
  );
}
