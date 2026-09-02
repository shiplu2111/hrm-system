/** Pagination and shared API primitives — see SHARED_TYPES.md */

export interface PaginationMeta {
  page: number;
  total: number;
  pageSize?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncableRecord {
  /** Client-generated UUID */
  local_id: string;
  /** Populated after first successful sync */
  server_id?: string;
  sync_status: SyncStatus;
}

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'finalize';
