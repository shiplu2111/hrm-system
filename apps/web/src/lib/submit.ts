import type { SubmitResult } from '@/lib/forms';

export async function postForm(url: string, payload: unknown): Promise<SubmitResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as SubmitResult | null;
    if (data && typeof data === 'object' && 'ok' in data) return data;
    return { ok: false, error: `Something went wrong (HTTP ${res.status}). Please try again.` };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}
