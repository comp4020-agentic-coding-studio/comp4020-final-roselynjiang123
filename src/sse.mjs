// In-memory SSE subscriber lists: delivery plumbing, not durable game state
// (brief §7). Each subscriber gets a fresh database-derived snapshot on
// connect and again whenever notify() is called for its table -- never a
// replayed event log -- so a missed update or a restart is recovered by
// reconstruction, not retransmission (brief §7, §9 item 10).
export function createSseHub() {
  const subscribersByTable = new Map();

  function subscribe(tableId, subscriber) {
    const set = subscribersByTable.get(tableId) ?? new Set();
    set.add(subscriber);
    subscribersByTable.set(tableId, set);
    return () => {
      set.delete(subscriber);
      if (set.size === 0) subscribersByTable.delete(tableId);
    };
  }

  function notify(tableId) {
    const set = subscribersByTable.get(tableId);
    if (!set) return;
    for (const subscriber of set) subscriber();
  }

  function subscriberCount(tableId) {
    return subscribersByTable.get(tableId)?.size ?? 0;
  }

  return { subscribe, notify, subscriberCount };
}
