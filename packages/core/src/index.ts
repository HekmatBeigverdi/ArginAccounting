export type EntityId = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface AuditableEntity extends BaseEntity {
  createdBy?: EntityId | null;
  updatedBy?: EntityId | null;
}
