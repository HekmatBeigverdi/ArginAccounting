import { createDomainEvent, type CorrelationContext, type DomainEvent } from "@argin/platform";
import type { AccountingUnitOfWork, AccountingUnitOfWorkRepositories } from "../contracts/accounting-unit-of-work.ts";
import type { CodingTemplateAuthorizer, CodingTemplateClock, CodingTemplateEventPublisher, CodingTemplateIdentifierGenerator } from "../contracts/coding-template-runtime.ts";
import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";
import { createCodingTemplate, publishCodingTemplate, retireCodingTemplate, updateCodingTemplateDraft, type CodingTemplate, type CodingTemplateActivityType, type CodingTemplateOwnership } from "../domain/coding-template.ts";
import { codingTemplatePermissions, type CodingTemplatePermission } from "./coding-template-permissions.ts";

export type CodingTemplateLifecycleErrorCode = "invalid_identifier" | "permission_denied" | "built_in_permission_required" | "repository_unavailable" | "template_not_found" | "template_code_exists" | "stale_version";
export class CodingTemplateLifecycleError extends Error {
  constructor(
    readonly code: CodingTemplateLifecycleErrorCode,
    readonly field: string | null = null,
  ) {
    super(code);
    this.name = "CodingTemplateLifecycleError";
  }
}

interface Context {
  readonly actorId: string;
  readonly correlation?: CorrelationContext;
}

export interface CodingTemplateLifecycleDependencies {
  readonly unitOfWork: AccountingUnitOfWork;
  readonly authorizer: CodingTemplateAuthorizer;
  readonly clock: CodingTemplateClock;
  readonly idGenerator: CodingTemplateIdentifierGenerator;
  readonly eventPublisher: CodingTemplateEventPublisher;
}

export interface CreateCodingTemplateCommand extends Context {
  readonly code: string;
  readonly persianName: string;
  readonly englishName?: string | null;
  readonly activityType: CodingTemplateActivityType;
  readonly ownership: CodingTemplateOwnership;
}

export interface UpdateCodingTemplateDraftCommand extends Context {
  readonly templateId: string;
  readonly expectedOptimisticVersion: number;
  readonly persianName: string;
  readonly englishName?: string | null;
  readonly activityType: CodingTemplateActivityType;
}

export interface PublishCodingTemplateCommand extends Context {
  readonly templateId: string;
  readonly expectedOptimisticVersion: number;
  readonly content: Readonly<CodingTemplateVersionContent>;
  readonly source: {
    readonly type: "catalog" | "excel" | "manual";
    readonly reference: string;
    readonly contractVersion: string;
    readonly contentFingerprint: string;
  };
}

export interface RetireCodingTemplateCommand extends Context {
  readonly templateId: string;
  readonly expectedOptimisticVersion: number;
}

function required(value: string, field: string): string {
  const result = value.trim();
  if (!result) {
    throw new CodingTemplateLifecycleError("invalid_identifier", field);
  }
  return result;
}

function repositories(
  all: AccountingUnitOfWorkRepositories,
): {
  templates: NonNullable<AccountingUnitOfWorkRepositories["codingTemplates"]>;
  versions: NonNullable<AccountingUnitOfWorkRepositories["codingTemplateVersions"]>;
} {
  if (!all.codingTemplates || !all.codingTemplateVersions) {
    throw new CodingTemplateLifecycleError("repository_unavailable");
  }
  return { templates: all.codingTemplates, versions: all.codingTemplateVersions };
}

async function authorize(
  deps: CodingTemplateLifecycleDependencies,
  permission: CodingTemplatePermission,
  ownership?: CodingTemplateOwnership,
): Promise<void> {
  const full = await deps.authorizer.hasPermission("system.full-access");

  if (!full && !(await deps.authorizer.hasPermission(permission))) {
    throw new CodingTemplateLifecycleError("permission_denied");
  }

  if (
    ownership === "built_in" &&
    !full &&
    !(await deps.authorizer.hasPermission(codingTemplatePermissions.manageBuiltIn))
  ) {
    throw new CodingTemplateLifecycleError("built_in_permission_required");
  }
}

function snapshot(
  value: Readonly<CodingTemplate> | null,
): {
  id: string;
  code: string;
  persianName: string;
  englishName: string | null;
  activityType: CodingTemplateActivityType;
  ownership: CodingTemplateOwnership;
  lifecycle: CodingTemplate["lifecycle"];
  latestPublishedVersion: number | null;
  optimisticVersion: number;
} | null {
  if (value === null) return null;

  return Object.freeze({
    id: String(value.id),
    code: String(value.code),
    persianName: String(value.persianName),
    englishName: value.englishName === null ? null : String(value.englishName),
    activityType: value.activityType,
    ownership: value.ownership,
    lifecycle: value.lifecycle,
    latestPublishedVersion: value.latestPublishedVersion,
    optimisticVersion: value.optimisticVersion,
  });
}

function event(
  deps: CodingTemplateLifecycleDependencies,
  command: Context,
  action: "created" | "draft-updated" | "published" | "retired",
  before: Readonly<CodingTemplate> | null,
  after: Readonly<CodingTemplate>,
  source: unknown = null,
): DomainEvent {
  const beforeSnapshot = snapshot(before);
  const afterSnapshot = snapshot(after);

  const eventPayload = Object.freeze({
    actorId: command.actorId,
    templateId: String(after.id),
    ownership: after.ownership,
    source,
    before: beforeSnapshot,
    after: afterSnapshot,
  });

  const correlationContext = command.correlation
    ? { correlationContext: command.correlation }
    : {};

  return createDomainEvent(
    {
      clock: {
        now: () => deps.clock.now(),
        nowIso: () => deps.clock.now().toISOString(),
      },
      idGenerator: deps.idGenerator,
    },
    {
      eventType: `accounting.coding-template.${action}`,
      aggregateId: String(after.id),
      aggregateType: "coding-template",
      aggregateVersion: after.optimisticVersion,
      ...correlationContext,
      payload: eventPayload,
      metadata: Object.freeze({ module: "accounting", audit: true }),
    },
  );
}

export async function createCodingTemplateDraft(
  command: CreateCodingTemplateCommand,
  deps: CodingTemplateLifecycleDependencies,
): Promise<CodingTemplate> {
  const actorId = required(command.actorId, "actorId");
  await authorize(deps, codingTemplatePermissions.create, command.ownership);

  let emitted: DomainEvent | null = null;

  const result = await deps.unitOfWork.run(async (all) => {
    const r = repositories(all);

    // Check for existing template code
    const codeExists = await r.templates.findByCode(command.code);
    if (codeExists) {
      throw new CodingTemplateLifecycleError("template_code_exists", "code");
    }

    // Create template
    const value = createCodingTemplate({
      ...command,
      id: deps.idGenerator.generate(),
      createdAt: deps.clock.now().toISOString(),
    });

    await r.templates.create(value);

    // Emit event
    emitted = event(
      deps,
      { ...command, actorId },
      "created",
      null,
      value,
    );

    return value;
  });

  if (emitted) {
    await deps.eventPublisher.publish(emitted);
  }

  return result;
}
async function loadForMutation(
  all: AccountingUnitOfWorkRepositories,
  id: string,
  expected: number,
): Promise<{
  r: ReturnType<typeof repositories>;
  current: CodingTemplate;
}> {
  const r = repositories(all);
  const current = await r.templates.findById(id);

  if (!current) {
    throw new CodingTemplateLifecycleError("template_not_found", "templateId");
  }

  if (current.optimisticVersion !== expected) {
    throw new CodingTemplateLifecycleError(
      "stale_version",
      "expectedOptimisticVersion",
    );
  }

  return { r, current };
}
export async function updateCodingTemplateDraftCommand(
  command: UpdateCodingTemplateDraftCommand,
  deps: CodingTemplateLifecycleDependencies,
): Promise<CodingTemplate> {
  const id = required(command.templateId, "templateId");
  const actorId = required(command.actorId, "actorId");

  let emitted: DomainEvent | null = null;

  const result = await deps.unitOfWork.run(async (all) => {
    const { r, current } = await loadForMutation(
      all,
      id,
      command.expectedOptimisticVersion,
    );

    await authorize(
      deps,
      codingTemplatePermissions.updateDraft,
      current.ownership,
    );

    // Update template
    const value = updateCodingTemplateDraft(current, {
      ...command,
      updatedAt: deps.clock.now().toISOString(),
    });

    await r.templates.update(value);

    // Emit event
    emitted = event(
      deps,
      { ...command, actorId },
      "draft-updated",
      current,
      value,
    );

    return value;
  });

  if (emitted) {
    await deps.eventPublisher.publish(emitted);
  }

  return result;
}
export async function publishCodingTemplateCommand(
  command: PublishCodingTemplateCommand,
  deps: CodingTemplateLifecycleDependencies,
): Promise<{
  template: CodingTemplate;
  version: { id: string; versionNumber: number };
}> {
  const id = required(command.templateId, "templateId");
  const actorId = required(command.actorId, "actorId");

  let emitted: DomainEvent | null = null;

  const result = await deps.unitOfWork.run(async (all) => {
    const { r, current } = await loadForMutation(
      all,
      id,
      command.expectedOptimisticVersion,
    );

    await authorize(
      deps,
      codingTemplatePermissions.publish,
      current.ownership,
    );

    // Publish template
    const published = publishCodingTemplate(current, {
      id: deps.idGenerator.generate(),
      source: command.source,
      publishedAt: deps.clock.now().toISOString(),
      publishedBy: actorId,
    });

    // Persist version and template
    await r.versions.create({
      version: published.version,
      content: command.content,
    });
    await r.templates.update(published.template);

    // Emit event
    emitted = event(
      deps,
      { ...command, actorId },
      "published",
      current,
      published.template,
      command.source,
    );

    return published;
  });

  if (emitted) {
    await deps.eventPublisher.publish(emitted);
  }

  return result;
}
export async function retireCodingTemplateCommand(
  command: RetireCodingTemplateCommand,
  deps: CodingTemplateLifecycleDependencies,
): Promise<CodingTemplate> {
  const id = required(command.templateId, "templateId");
  const actorId = required(command.actorId, "actorId");

  let emitted: DomainEvent | null = null;

  const result = await deps.unitOfWork.run(async (all) => {
    const { r, current } = await loadForMutation(
      all,
      id,
      command.expectedOptimisticVersion,
    );

    await authorize(
      deps,
      codingTemplatePermissions.retire,
      current.ownership,
    );

    // Retire template
    const value = retireCodingTemplate(
      current,
      deps.clock.now().toISOString(),
    );

    await r.templates.update(value);

    // Emit event
    emitted = event(
      deps,
      { ...command, actorId },
      "retired",
      current,
      value,
    );

    return value;
  });

  if (emitted) {
    await deps.eventPublisher.publish(emitted);
  }

  return result;
}
