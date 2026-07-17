import type {
  Address,
  AddressRepository,
  CreateAddressInput
} from "@argin/company";

import type {
  DatabaseExecutor
} from "@argin/database";

interface AddressRow {
  id: string;
  owner_type: Address["ownerType"];
  owner_id: string;
  address_type: Address["addressType"];
  province: string | null;
  city: string | null;
  address_line: string;
  postal_code: string | null;
  phone: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

function mapAddress(row: AddressRow): Address {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    addressType: row.address_type,
    province: row.province,
    city: row.city,
    addressLine: row.address_line,
    postalCode: row.postal_code,
    phone: row.phone,
    isPrimary: row.is_primary === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteAddressRepository
  implements AddressRepository {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async create(
    input: CreateAddressInput
  ): Promise<Address> {
    const now = new Date().toISOString();

    const address: Address = {
      id: crypto.randomUUID(),
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      addressType: input.addressType,
      province: input.province ?? null,
      city: input.city ?? null,
      addressLine: input.addressLine,
      postalCode: input.postalCode ?? null,
      phone: input.phone ?? null,
      isPrimary: input.isPrimary,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(
      `
        INSERT INTO addresses (
          id,
          owner_type,
          owner_id,
          address_type,
          province,
          city,
          address_line,
          postal_code,
          phone,
          is_primary,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        address.id,
        address.ownerType,
        address.ownerId,
        address.addressType,
        address.province,
        address.city,
        address.addressLine,
        address.postalCode,
        address.phone,
        address.isPrimary,
        address.createdAt,
        address.updatedAt
      ]
    );

    return address;
  }

  async findByOwner(
    ownerType: Address["ownerType"],
    ownerId: string
  ): Promise<Address[]> {
    const rows = await this.database.query<AddressRow>(
      `
        SELECT *
        FROM addresses
        WHERE owner_type = ?
          AND owner_id = ?
        ORDER BY is_primary DESC, created_at
      `,
      [ownerType, ownerId]
    );

    return rows.map(mapAddress);
  }
}
