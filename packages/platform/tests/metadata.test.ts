import assert from "node:assert/strict";
import test from "node:test";

import {
  DuplicateFieldMetadataError,
  DuplicateMetadataError,
  InMemoryMetadataRegistry,
  MetadataNotFoundError,
  type EntityMetadata,
} from "../src/index.ts";

function createPartyMetadata(): EntityMetadata {
  return {
    entityType: "master-data.party",
    moduleName: "master-data",
    label: "طرف حساب",
    pluralLabel: "طرف حساب‌ها",
    description:
      "اطلاعات مشتریان، تأمین‌کنندگان و سایر اشخاص",
    tags: ["master-data", "accounting"],
    fields: [
      {
        fieldName: "partyId",
        label: "شناسه",
        valueType: "identifier",
        required: true,
        readOnly: true,
        hidden: true,
        order: 0,
      },
      {
        fieldName: "code",
        label: "کد",
        valueType: "string",
        required: true,
        searchable: true,
        sortable: true,
        order: 10,
      },
      {
        fieldName: "name",
        label: "نام",
        valueType: "string",
        required: true,
        searchable: true,
        sortable: true,
        filterable: true,
        order: 20,
      },
      {
        fieldName: "partyType",
        label: "نوع طرف حساب",
        valueType: "enum",
        required: true,
        filterable: true,
        order: 30,
        options: [
          {
            value: "customer",
            label: "مشتری",
          },
          {
            value: "supplier",
            label: "تأمین‌کننده",
          },
          {
            value: "both",
            label: "مشتری و تأمین‌کننده",
          },
        ],
      },
      {
        fieldName: "defaultAccountId",
        label: "حساب پیش‌فرض",
        valueType: "reference",
        referenceType: "accounting.account",
        order: 40,
      },
      {
        fieldName: "isActive",
        label: "فعال",
        valueType: "boolean",
        required: true,
        filterable: true,
        order: 50,
      },
    ],
  };
}

test("metadata registry stores entity metadata", () => {
  const registry = new InMemoryMetadataRegistry();

  registry.register(createPartyMetadata());

  const metadata =
    registry.require("master-data.party");

  assert.equal(metadata.label, "طرف حساب");
  assert.equal(
    metadata.pluralLabel,
    "طرف حساب‌ها",
  );
  assert.equal(metadata.fields.length, 6);
  assert.equal(registry.entityCount, 1);
});

test("metadata can be supplied in the constructor", () => {
  const registry = new InMemoryMetadataRegistry([
    createPartyMetadata(),
  ]);

  assert.equal(
    registry.has("master-data.party"),
    true,
  );
});

test("metadata fields can be retrieved", () => {
  const registry = new InMemoryMetadataRegistry([
    createPartyMetadata(),
  ]);

  const field = registry.getField(
    "master-data.party",
    "partyType",
  );

  assert.equal(field?.label, "نوع طرف حساب");
  assert.equal(field?.valueType, "enum");
  assert.equal(field?.options?.length, 3);
});

test("missing fields return undefined", () => {
  const registry = new InMemoryMetadataRegistry([
    createPartyMetadata(),
  ]);

  assert.equal(
    registry.getField(
      "master-data.party",
      "missingField",
    ),
    undefined,
  );

  assert.equal(
    registry.getField(
      "sales.invoice",
      "invoiceId",
    ),
    undefined,
  );
});

test("require reports missing metadata", () => {
  const registry = new InMemoryMetadataRegistry();

  assert.throws(
    () => registry.require("sales.invoice"),
    (error: unknown) =>
      error instanceof MetadataNotFoundError &&
      error.code === "metadata.not-found" &&
      error.entityType === "sales.invoice",
  );
});

test("duplicate entity metadata is rejected", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        createPartyMetadata(),
        createPartyMetadata(),
      ]),
    (error: unknown) =>
      error instanceof DuplicateMetadataError &&
      error.code ===
        "metadata.duplicate-entity",
  );
});

test("duplicate field metadata is rejected", () => {
  const metadata = createPartyMetadata();

  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...metadata,
          fields: [
            ...metadata.fields,
            {
              fieldName: "code",
              label: "کد تکراری",
              valueType: "string",
            },
          ],
        },
      ]),
    (error: unknown) =>
      error instanceof
        DuplicateFieldMetadataError &&
      error.code === "metadata.duplicate-field" &&
      error.fieldName === "code",
  );
});

test("entity type must match module prefix", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          moduleName: "sales",
        },
      ]),
    TypeError,
  );
});

test("entity types require module-prefixed notation", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          entityType: "Party",
        },
      ]),
    TypeError,
  );

  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          entityType: "party",
        },
      ]),
    TypeError,
  );
});

test("field names must use lower camelCase", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          fields: [
            {
              fieldName: "Party_Code",
              label: "کد",
              valueType: "string",
            },
          ],
        },
      ]),
    TypeError,
  );
});

test("reference fields require reference types", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          fields: [
            {
              fieldName: "accountId",
              label: "حساب",
              valueType: "reference",
            },
          ],
        },
      ]),
    TypeError,
  );
});

test("non-reference fields reject reference types", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          fields: [
            {
              fieldName: "name",
              label: "نام",
              valueType: "string",
              referenceType: "accounting.account",
            },
          ],
        },
      ]),
    TypeError,
  );
});

test("enum fields require options", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          fields: [
            {
              fieldName: "status",
              label: "وضعیت",
              valueType: "enum",
            },
          ],
        },
      ]),
    TypeError,
  );
});

test("duplicate enum option values are rejected", () => {
  assert.throws(
    () =>
      new InMemoryMetadataRegistry([
        {
          ...createPartyMetadata(),
          fields: [
            {
              fieldName: "status",
              label: "وضعیت",
              valueType: "enum",
              options: [
                {
                  value: "active",
                  label: "فعال",
                },
                {
                  value: "active",
                  label: "فعال تکراری",
                },
              ],
            },
          ],
        },
      ]),
    TypeError,
  );
});

test("default field settings are normalized", () => {
  const registry = new InMemoryMetadataRegistry([
    {
      entityType: "sales.invoice",
      moduleName: "sales",
      label: "فاکتور فروش",
      fields: [
        {
          fieldName: "description",
          label: "توضیحات",
          valueType: "string",
        },
      ],
    },
  ]);

  const field = registry.getField(
    "sales.invoice",
    "description",
  );

  assert.equal(field?.required, false);
  assert.equal(field?.readOnly, false);
  assert.equal(field?.searchable, false);
  assert.equal(field?.sortable, false);
  assert.equal(field?.filterable, false);
  assert.equal(field?.hidden, false);
  assert.equal(field?.custom, false);
  assert.equal(field?.order, 0);
});

test("metadata list is sorted by entity type", () => {
  const registry = new InMemoryMetadataRegistry([
    {
      entityType: "sales.invoice",
      moduleName: "sales",
      label: "فاکتور فروش",
      fields: [],
    },
    createPartyMetadata(),
    {
      entityType: "accounting.account",
      moduleName: "accounting",
      label: "حساب",
      fields: [],
    },
  ]);

  assert.deepEqual(
    registry.list().map(
      (metadata) => metadata.entityType,
    ),
    [
      "accounting.account",
      "master-data.party",
      "sales.invoice",
    ],
  );
});

test("metadata registry can be cleared", () => {
  const registry = new InMemoryMetadataRegistry([
    createPartyMetadata(),
  ]);

  registry.clear();

  assert.equal(registry.entityCount, 0);
  assert.deepEqual(registry.list(), []);
});
