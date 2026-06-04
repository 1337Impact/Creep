import { getChatStorageKey } from "@/constants/chat";
import type { ChatPersistedState } from "@/types/chat";

/** Move chat state to the current page key and delete the previous key. */
export async function relocateChatSession(
  fromKey: string,
  payload: ChatPersistedState
): Promise<string> {
  const toKey = getChatStorageKey();
  await chrome.storage.local.set({ [toKey]: payload });
  if (fromKey !== toKey) {
    await chrome.storage.local.remove(fromKey);
  }
  return toKey;
}
