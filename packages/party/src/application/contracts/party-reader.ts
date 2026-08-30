import type {
  PageResult,
  PartyDetailDto,
  PartySelectorDto,
  PartySummaryDto
} from "./party-dto.ts";
import type {
  GetPartyByIdQuery,
  ListPartiesQuery,
  PartySelectorQuery
} from "./party-queries.ts";

export interface PartyReader {
  getById(query: GetPartyByIdQuery): Promise<PartyDetailDto | null>;
  list(query: ListPartiesQuery): Promise<PageResult<PartySummaryDto>>;
  select(query: PartySelectorQuery): Promise<readonly PartySelectorDto[]>;
}
