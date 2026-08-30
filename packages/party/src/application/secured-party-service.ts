import type {
  AddPartyRoleCommand,
  CreatePartyCommand,
  RemovePartyRoleCommand,
  SetPartyStatusCommand,
  UpdatePartyCommand
} from "./contracts/party-commands.ts";
import type {
  GetPartyByIdQuery,
  ListPartiesQuery,
  PartySelectorQuery
} from "./contracts/party-queries.ts";
import type { PartyReader } from "./contracts/party-reader.ts";
import type {
  PartyAuditAction,
  PartyAuditSink,
  PartyAuthorizationPolicy,
  PartyPermission
} from "./contracts/party-security.ts";
import { partyPermissions } from "./contracts/party-security.ts";
import type {
  PageResult,
  PartyDetailDto,
  PartySelectorDto,
  PartySummaryDto
} from "./contracts/party-dto.ts";
import type { Party } from "../domain/party.ts";
import {
  PartyApplicationService,
  type PartyMutationResult
} from "./party-service.ts";

export class SecuredPartyApplicationService {
  constructor(
    private readonly inner: PartyApplicationService,
    private readonly authorization: PartyAuthorizationPolicy,
    private readonly audit: PartyAuditSink
  ) {}

  async create(command: CreatePartyCommand): Promise<PartyMutationResult> {
    await this.require(command.context, partyPermissions.create);
    if ((command.roles?.length ?? 0) > 0) {
      await this.require(command.context, partyPermissions.manageRoles);
    }
    const result = await this.inner.create(command);
    if (!result.idempotentReplay) {
      await this.record("party.create", command.context, result.party.id, {
        classification: result.party.classification,
        advisoryDuplicateCount: result.advisoryMatches.length
      });
    }
    return result;
  }

  async update(command: UpdatePartyCommand): Promise<PartyMutationResult> {
    await this.require(command.context, partyPermissions.update);
    const result = await this.inner.update(command);
    await this.record("party.update", command.context, result.party.id, {
      classification: result.party.classification,
      advisoryDuplicateCount: result.advisoryMatches.length
    });
    return result;
  }

  async setStatus(command: SetPartyStatusCommand): Promise<Party> {
    await this.require(command.context, partyPermissions.changeStatus);
    const party = await this.inner.setStatus(command);
    await this.record("party.change-status", command.context, party.id, {
      status: party.status
    });
    return party;
  }

  async addRole(command: AddPartyRoleCommand): Promise<Party> {
    await this.require(command.context, partyPermissions.manageRoles);
    const party = await this.inner.addRole(command);
    await this.record("party.add-role", command.context, party.id, {
      role: command.role
    });
    return party;
  }

  async removeRole(command: RemovePartyRoleCommand): Promise<Party> {
    await this.require(command.context, partyPermissions.manageRoles);
    const party = await this.inner.removeRole(command);
    await this.record("party.remove-role", command.context, party.id, {
      role: command.role
    });
    return party;
  }

  private async require(
    context: CreatePartyCommand["context"],
    permission: PartyPermission
  ): Promise<void> {
    await this.authorization.require({
      actorId: context.actorId,
      companyId: context.companyId,
      correlationId: context.correlationId,
      requestId: context.requestId ?? null
    }, permission);
  }

  private async record(
    action: PartyAuditAction,
    context: CreatePartyCommand["context"],
    partyId: string,
    metadata: Readonly<Record<string, string | number | boolean | null>>
  ): Promise<void> {
    await this.audit.record(Object.freeze({
      action,
      actorId: context.actorId,
      companyId: context.companyId,
      partyId,
      correlationId: context.correlationId,
      requestId: context.requestId ?? null,
      occurredAt: context.occurredAt,
      metadata: Object.freeze({ ...metadata })
    }));
  }
}

export class SecuredPartyReader implements PartyReader {
  constructor(
    private readonly inner: PartyReader,
    private readonly authorization: PartyAuthorizationPolicy,
    private readonly context: {
      readonly actorId: string;
      readonly correlationId: string;
      readonly requestId?: string | null;
    }
  ) {}

  async getById(query: GetPartyByIdQuery): Promise<PartyDetailDto | null> {
    await this.require(query.companyId);
    return this.inner.getById(query);
  }

  async list(query: ListPartiesQuery): Promise<PageResult<PartySummaryDto>> {
    await this.require(query.filter.companyId);
    return this.inner.list(query);
  }

  async select(query: PartySelectorQuery): Promise<readonly PartySelectorDto[]> {
    await this.require(query.companyId);
    return this.inner.select(query);
  }

  private async require(companyId: string): Promise<void> {
    await this.authorization.require({
      actorId: this.context.actorId,
      companyId,
      correlationId: this.context.correlationId,
      requestId: this.context.requestId ?? null
    }, partyPermissions.view);
  }
}
