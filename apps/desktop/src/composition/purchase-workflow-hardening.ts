type AsyncWork<T> = () => Promise<T>;

const workflowTails = new Map<string, Promise<void>>();
const submissionResults = new Map<string, Promise<unknown>>();

export function purchaseWorkflowKey(companyId: string, documentId: string): string {
  const company = companyId.trim();
  const document = documentId.trim();
  if (!company || !document) throw new TypeError("purchase.workflow.identity_required");
  return company + ":" + document;
}

/**
 * Serializes mutating Purchase workflow operations for one source document inside
 * the desktop runtime. Durable DB/application idempotency remains the authority;
 * this lock closes same-process races before they become competing mutations.
 */
export async function withPurchaseWorkflowLock<T>(
  key: string,
  work: AsyncWork<T>,
): Promise<T> {
  const normalized = key.trim();
  if (!normalized) throw new TypeError("purchase.workflow.lock_key_required");

  const previous = workflowTails.get(normalized) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => gate);
  workflowTails.set(normalized, tail);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (workflowTails.get(normalized) === tail) workflowTails.delete(normalized);
  }
}

/**
 * Reuses the same in-flight/committed result for a UI submission token. This is
 * deliberately an optimization/safety belt, not a persistence authority.
 */
export function oncePerPurchaseSubmission<T>(
  submissionId: string,
  work: AsyncWork<T>,
): Promise<T> {
  const key = submissionId.trim();
  if (!key) throw new TypeError("purchase.workflow.submission_id_required");

  const prior = submissionResults.get(key) as Promise<T> | undefined;
  if (prior) return prior;

  const current = work();
  submissionResults.set(key, current);
  void current.catch(() => {
    if (submissionResults.get(key) === current) submissionResults.delete(key);
  });

  // Keep a bounded replay cache for successful double-click replays.
  if (submissionResults.size > 256) {
    const oldest = submissionResults.keys().next().value as string | undefined;
    if (oldest && oldest !== key) submissionResults.delete(oldest);
  }
  return current;
}
