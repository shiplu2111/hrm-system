import { ApiError, getTenantAccessToken } from './tenant-api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/** Files behind the bearer token are fetched as blobs rather than linked directly. */
export async function fetchTenantFile(
  path: string,
  fallback: { filename: string; errorMessage: (status: number) => string },
): Promise<DownloadedFile> {
  const token = getTenantAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    throw new ApiError(
      body.error?.message ?? fallback.errorMessage(response.status),
      response.status,
      body.error?.code,
    );
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallback.filename;
  return { blob: await response.blob(), filename };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
