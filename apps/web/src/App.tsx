import type { ApiResponse } from '@hrm/shared-types';

const placeholderResponse: ApiResponse<{ message: string }> = {
  data: { message: 'HRM Web is running' },
};

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          HRM Platform
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Web App Boilerplate
        </h1>
        <p className="mt-4 text-slate-600">
          Admin and employee web portals will live here. Shared types are wired
          via <code className="rounded bg-slate-100 px-1">@hrm/shared-types</code>.
        </p>
        <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
          {placeholderResponse.data.message}
        </p>
      </div>
    </main>
  );
}
