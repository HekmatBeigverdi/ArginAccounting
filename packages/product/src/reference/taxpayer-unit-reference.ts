export interface TaxpayerUnitReferenceEntry {
  readonly code: string;
  readonly title: string;
  readonly isActive: boolean;
}

export interface TaxpayerUnitReferenceDataset {
  readonly datasetVersion: string;
  readonly sourceName: string;
  readonly sourceUri?: string | null;
  readonly sourceDigest?: string | null;
  readonly entries: readonly TaxpayerUnitReferenceEntry[];
}

export interface TaxpayerUnitReferenceDiff {
  readonly added: readonly TaxpayerUnitReferenceEntry[];
  readonly changed: readonly TaxpayerUnitReferenceEntry[];
  readonly deactivated: readonly TaxpayerUnitReferenceEntry[];
}

const required = (value: string, field: string): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized) {
    throw new Error(`taxpayer-unit-reference.${field}.required`);
  }
  return normalized;
};

export const normalizeTaxpayerUnitReferenceDataset = (
  dataset: TaxpayerUnitReferenceDataset,
): Readonly<TaxpayerUnitReferenceDataset> => {
  const seen = new Set<string>();
  const entries = dataset.entries.map((entry) => {
    const code = required(entry.code, "code");
    const title = required(entry.title, "title");
    if (seen.has(code)) {
      throw new Error("taxpayer-unit-reference.code.duplicate");
    }
    seen.add(code);
    return Object.freeze({ code, title, isActive: entry.isActive });
  });

  return Object.freeze({
    datasetVersion: required(dataset.datasetVersion, "dataset-version"),
    sourceName: required(dataset.sourceName, "source-name"),
    sourceUri: dataset.sourceUri?.trim() || null,
    sourceDigest: dataset.sourceDigest?.trim() || null,
    entries: Object.freeze(entries),
  });
};

export const diffTaxpayerUnitReferenceDataset = (
  current: readonly TaxpayerUnitReferenceEntry[],
  incoming: readonly TaxpayerUnitReferenceEntry[],
): Readonly<TaxpayerUnitReferenceDiff> => {
  const currentByCode = new Map(current.map((entry) => [entry.code, entry]));
  const incomingByCode = new Map(incoming.map((entry) => [entry.code, entry]));

  const added: TaxpayerUnitReferenceEntry[] = [];
  const changed: TaxpayerUnitReferenceEntry[] = [];
  const deactivated: TaxpayerUnitReferenceEntry[] = [];

  for (const entry of incoming) {
    const existing = currentByCode.get(entry.code);
    if (!existing) {
      added.push(entry);
    } else if (existing.title !== entry.title || existing.isActive !== entry.isActive) {
      changed.push(entry);
    }
  }

  for (const entry of current) {
    if (!incomingByCode.has(entry.code) && entry.isActive) {
      deactivated.push(Object.freeze({ ...entry, isActive: false }));
    }
  }

  return Object.freeze({
    added: Object.freeze(added),
    changed: Object.freeze(changed),
    deactivated: Object.freeze(deactivated),
  });
};
