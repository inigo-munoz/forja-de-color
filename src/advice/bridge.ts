import type { AdvicePackage } from './schema';

/** Port: how an advice package reaches the user's AI chat and how the answer comes back. */
export interface AdvisorBridge {
  send(pkg: AdvicePackage): Promise<'shared' | 'fallback'>;
  /** The pasted answer, or null when it cannot be read (the UI then offers a textarea). */
  readAnswer(): Promise<string | null>;
}
