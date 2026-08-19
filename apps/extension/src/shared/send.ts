import type { Message, MessageResponse } from './messages';

/** Typed wrapper around chrome.runtime.sendMessage for the popup and side panel. */
export async function send<T>(message: Message): Promise<MessageResponse<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T> | undefined;
    return response ?? { ok: false, error: 'no_response' };
  } catch {
    // The service worker was asleep or the extension is reloading.
    return { ok: false, error: 'disconnected' };
  }
}
