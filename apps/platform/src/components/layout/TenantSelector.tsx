import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Layers,
  Lock,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import type { PlatformTenantPlan, PlatformTenantStatus, PlatformTenantSummary } from '@hrm/shared-types';
import { usePlatformTenant } from '@/context/PlatformTenantContext';

function planBadgeClass(plan: PlatformTenantPlan) {
  switch (plan) {
    case 'Enterprise':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'Business':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    case 'Starter':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

function statusDotClass(status: PlatformTenantStatus) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-400';
    case 'Trial':
      return 'bg-indigo-400';
    case 'Suspended':
      return 'bg-amber-400';
    case 'Cancelled':
      return 'bg-rose-400';
    default:
      return 'bg-slate-400';
  }
}

function statusPillClass(status: PlatformTenantStatus) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'Trial':
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    case 'Suspended':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'Cancelled':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

export function TenantSelector() {
  const { tenants, selectedTenant, setSelectedTenant } = usePlatformTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const filteredTenants = tenants.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.subdomain.toLowerCase().includes(q) ||
      t.plan.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button in Header */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`h-9 px-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium transition-all select-none ${
            selectedTenant
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:border-amber-400 shadow-sm shadow-amber-950/30'
              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
          }`}
          title="Filter platform views by tenant context"
        >
          <div className="flex items-center gap-2">
            <Building2
              className={`h-3.5 w-3.5 shrink-0 ${
                selectedTenant ? 'text-amber-400' : 'text-slate-400'
              }`}
            />
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Tenant:
            </span>
          </div>

          {selectedTenant ? (
            <div className="flex items-center gap-2">
              <span className="font-bold text-white max-w-[130px] sm:max-w-[180px] truncate">
                {selectedTenant.name}
              </span>
              <span
                className={`hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${planBadgeClass(
                  selectedTenant.plan,
                )}`}
              >
                {selectedTenant.plan}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusDotClass(selectedTenant.status)}`}
                title={`Status: ${selectedTenant.status}`}
              />
            </div>
          ) : (
            <span className="text-slate-400 font-normal italic">No tenant selected</span>
          )}

          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Quick clear button if a tenant is selected */}
        {selectedTenant && (
          <button
            type="button"
            onClick={() => setSelectedTenant(null)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors"
            title="Clear tenant context (return to No tenant selected)"
            aria-label="Clear tenant selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Searchable Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none">
          {/* Header & Isolation Guard Notice */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Layers className="h-4 w-4 text-amber-500" />
                <span>Select Tenant Scope</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {filteredTenants.length} of {tenants.length} tenants
              </span>
            </div>

            {/* Strict multi-tenancy boundary notice */}
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-200 font-semibold">Platform view filter only:</strong>{' '}
                Scopes platform views (Tenant Detail, Subscriptions, Usage). Staff cannot see or
                edit employee, attendance, or payroll data without an approved Support Access grant
                (Stage D).
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, subdomain, plan, or status..."
                className="w-full h-8 pl-8 pr-7 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Option: Default State ("No tenant selected") */}
          <div className="p-1 border-b border-slate-800/60 bg-slate-900/60">
            <button
              type="button"
              onClick={() => {
                setSelectedTenant(null);
                setIsOpen(false);
              }}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-colors ${
                !selectedTenant
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                  : 'hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">No tenant selected</div>
                  <div className="text-[10px] text-slate-400">
                    Default state · Show global cross-tenant platform views
                  </div>
                </div>
              </div>
              {!selectedTenant && <Check className="h-4 w-4 text-amber-400" />}
            </button>
          </div>

          {/* Tenants List */}
          <div className="max-h-64 overflow-y-auto p-1 divide-y divide-slate-800/40">
            {filteredTenants.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No tenants matching &quot;{query}&quot;
              </div>
            ) : (
              filteredTenants.map((t) => {
                const isSelected = selectedTenant?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTenant(t);
                      setIsOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-colors ${
                      isSelected
                        ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                        : 'hover:bg-slate-800/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {t.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-2">
                          <span className="truncate">{t.name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${planBadgeClass(
                              t.plan,
                            )}`}
                          >
                            {t.plan}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{t.subdomain}.cmsnbd.com</span>
                          <span>·</span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] border ${statusPillClass(
                              t.status,
                            )}`}
                          >
                            <span className={`h-1 w-1 rounded-full ${statusDotClass(t.status)}`} />
                            {t.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-amber-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
