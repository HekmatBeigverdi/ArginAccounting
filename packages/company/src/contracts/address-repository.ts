import type {
  Address,
  CreateAddressInput
} from "../domain/address";

export interface AddressRepository {
  create(input: CreateAddressInput): Promise<Address>;

  findByOwner(
    ownerType: Address["ownerType"],
    ownerId: string
  ): Promise<Address[]>;
}
