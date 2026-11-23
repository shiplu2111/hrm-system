import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Clock,
  Calendar,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Upload,
  Edit3,
  Globe,
  Tag,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  FileCode,
  FileText,
} from 'lucide-react';
import type {
  CountrySummary,
  PlatformDefaultTemplate,
  PlatformTemplateCategory,
} from '@hrm/shared-types';
import { TemplatePayloadViewer } from './TemplatePayloadViewer';

interface TemplateVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: PlatformTemplateCategory;
  categoryLabel: string;
  templates: PlatformDefaultTemplate[];
  countries: CountrySummary[];
  selectedCountryFilter?: string;
  onCloneVersion: (template: PlatformDefaultTemplate) => void;
  onPublishDraft: (template: PlatformDefaultTemplate) => void;
  onEditDraft: (template: PlatformDefaultTemplate) => void;
}

export function TemplateVersionHistoryModal({
  isOpen,
  onClose,
  category,
  categoryLabel,
  templates,
  countries,
  selectedCountryFilter = 'all',
  onCloneVersion,
  onPublishDraft,
  onEditDraft,
}: TemplateVersionHistoryModalProps) {
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>(selectedCountryFilter);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Filter templates for this category
  const categoryTemplates = useMemo(() => {
    return templates
      .filter((t) => t.category === category)
      .filter((t) => {
        if (jurisdictionFilter === 'all') return true;
        if (jurisdictionFilter === 'global') return !t.countryId;
        return t.countryId === jurisdictionFilter;
      })
      .filter((t) => {
        if (statusFilter === 'all') return true;
        return t.status === statusFilter;
      })
      .sort((a, b) => {
        // Sort by version desc, then createdAt desc
        if (b.version !== a.version) return b.version - a.version;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [templates, category, jurisdictionFilter, statusFilter]);

  // Selected template for payload inspection
  const activeTemplate = useMemo(() => {
    if (selectedTemplateId) {
      const found = categoryTemplates.find((t) => t.id === selectedTemplateId);
      if (found) return found;
    }
    return categoryTemplates[0] || null;
  }, [categoryTemplates, selectedTemplateId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Version History & Audit Log
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                  {categoryLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review historical iterations, published baselines, audit summaries, and statutory legislative references.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prominent Tenant Provisioning Isolation Notice */}
        <div className="px-5 py-3 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-b border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Applies to new tenants only:</strong> Historical and draft versions track the evolution of baseline templates. Changing or publishing a version affects only newly provisioned tenant workspaces; existing tenants retain their independent workspace settings.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold shrink-0">
            Tenant Isolation Guaranteed
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Jurisdiction:</span>
              <select
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1 font-semibold"
              >
                <option value="all">All Jurisdictions ({categoryTemplates.length})</option>
                <option value="global">🌐 Global Default Only</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.isoCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1 font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published Only</option>
                <option value="draft">Draft Only</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Showing {categoryTemplates.length} version{categoryTemplates.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Body: Split View (Timeline List on Left, Detail Viewer on Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: Version History Timeline */}
          <div className="md:col-span-5 border-r border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[55vh] p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/50">
            {categoryTemplates.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No version history recorded for the selected jurisdiction.
              </div>
            ) : (
              categoryTemplates.map((item, idx) => {
                const isSelected = activeTemplate?.id === item.id;
                const isPublished = item.status === 'published';
                const isDraft = item.status === 'draft';
                const isArchived = item.status === 'archived';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedTemplateId(item.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-md ring-1 ring-indigo-500'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          v{item.version}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isPublished
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isDraft
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {item.name}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {item.country ? `${item.country.name} (${item.country.isoCode})` : '🌐 Global Default'}
                      </span>
                    </div>

                    {item.changeSummary && (
                      <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                        "{item.changeSummary}"
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Effective: {item.effectiveFrom}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                        Inspect <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Version Inspector & Payload Preview */}
          <div className="md:col-span-7 overflow-y-auto max-h-[55vh] p-5 space-y-4 bg-white dark:bg-slate-900">
            {activeTemplate ? (
              <div className="space-y-4">
                {/* Active Version Summary Card */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                          Version {activeTemplate.version}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            activeTemplate.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : activeTemplate.status === 'draft'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {activeTemplate.status}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {activeTemplate.country
                            ? `${activeTemplate.country.name} (${activeTemplate.country.isoCode})`
                            : '🌐 Global Default'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {activeTemplate.name}
                      </h4>
                    </div>

                    {/* Version Specific Actions */}
                    <div className="flex items-center gap-2">
                      {activeTemplate.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onPublishDraft(activeTemplate);
                              onClose();
                            }}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onEditDraft(activeTemplate);
                              onClose();
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </>
                      )}

                      {activeTemplate.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => {
                            onCloneVersion(activeTemplate);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Clone as Next Draft
                        </button>
                      )}
                    </div>
                  </div>

                  {activeTemplate.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {activeTemplate.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Effective From</span>
                      <span>{activeTemplate.effectiveFrom}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Effective To</span>
                      <span>{activeTemplate.effectiveTo || 'Present (Active)'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Source Reference</span>
                      <span className="truncate block font-mono">{activeTemplate.sourceReference || 'Platform Baseline'}</span>
                    </div>
                  </div>

                  {activeTemplate.changeSummary && (
                    <div className="p-2 rounded bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 text-xs border border-indigo-100 dark:border-indigo-900/50">
                      <strong>Audit Log / Change Summary:</strong> {activeTemplate.changeSummary}
                    </div>
                  )}
                </div>

                {/* Payload Viewer */}
                <div>
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    Template Configuration Snapshot (v{activeTemplate.version})
                  </h5>
                  <TemplatePayloadViewer
                    category={activeTemplate.category}
                    payload={activeTemplate.payload}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                Select a version from the timeline on the left to inspect its configuration and audit history.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Changing default templates applies to new tenants only.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Version History
          </button>
        </div>
      </div>
    </div>
  );
}
