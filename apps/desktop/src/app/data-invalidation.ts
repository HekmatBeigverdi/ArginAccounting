export const desktopDataTopics = Object.freeze({
  journalVouchers: "accounting.journal-vouchers",
  approvalRequests: "approval.requests",
  auditEntries: "audit.entries",
  securityUsers: "security.users",
  securityUserAccess: "security.user-access",
  securityRoles: "security.roles",
  securityRolePermissions: "security.role-permissions",
});

export type DesktopDataTopic =
  (typeof desktopDataTopics)[keyof typeof desktopDataTopics];

type Listener = () => void;

const listeners = new Map<DesktopDataTopic, Set<Listener>>();

export function invalidateDesktopData(...topics: readonly DesktopDataTopic[]): void {
  for (const topic of new Set(topics)) {
    const topicListeners = listeners.get(topic);
    if (!topicListeners) continue;
    for (const listener of [...topicListeners]) listener();
  }
}

export function subscribeDesktopData(
  topic: DesktopDataTopic,
  listener: Listener,
): () => void {
  const topicListeners = listeners.get(topic) ?? new Set<Listener>();
  topicListeners.add(listener);
  listeners.set(topic, topicListeners);

  return () => {
    topicListeners.delete(listener);
    if (topicListeners.size === 0) listeners.delete(topic);
  };
}
