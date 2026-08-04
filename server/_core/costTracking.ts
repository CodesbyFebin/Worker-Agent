import { AsyncLocalStorage } from "async_hooks";

export interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
}

const storage = new AsyncLocalStorage<UsageAccumulator>();

/** Runs `fn` with a fresh usage accumulator in scope, returning both the result and the totals. */
export async function withUsageTracking<T>(fn: () => Promise<T>): Promise<{ result: T; usage: UsageAccumulator }> {
  const usage: UsageAccumulator = { inputTokens: 0, outputTokens: 0 };
  const result = await storage.run(usage, fn);
  return { result, usage };
}

/** Called by llm.ts after every completion — a no-op if there's no active tracking scope (e.g. a script run outside a task). */
export function recordUsage(inputTokens: number, outputTokens: number): void {
  const store = storage.getStore();
  if (!store) return;
  store.inputTokens += inputTokens;
  store.outputTokens += outputTokens;
}
