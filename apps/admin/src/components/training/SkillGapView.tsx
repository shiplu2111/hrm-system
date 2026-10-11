import { CheckCircle2, Target, TrendingDown, UserX, Users } from 'lucide-react';
import type { EmployeeSkillGapRow, SkillGapItem, SkillGapReport } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { SKILL_LEVEL_LABELS } from '@/lib/training-api';

function GapChip({ item, onClick }: { item: SkillGapItem; onClick?: () => void }) {
  const text =
    item.status === 'not_assessed'
      ? `${item.skillName}: not assessed · target ${SKILL_LEVEL_LABELS[item.targetLevel]}`
      : `${item.skillName}: ${SKILL_LEVEL_LABELS[item.currentLevel!]} → ${SKILL_LEVEL_LABELS[item.targetLevel]}`;
  const className =
    item.status === 'not_assessed'
      ? 'border border-dashed border-warning-400 text-warning-700 dark:text-warning-300'
      : 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300';
  const content = (
    <>
      {text}
      {item.status === 'below' ? <span className="ml-1 opacity-70">(−{item.gap})</span> : null}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-2 py-0.5 text-xs font-medium hover:ring-2 hover:ring-warning-400 ${className}`}
      title="Set level"
    >
      {content}
    </button>
  ) : (
    <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${className}`}>{content}</span>
  );
}

export function SkillGapView({
  report,
  rows,
  canEdit,
  canSetTargets,
  onSetTargets,
  onOpenGap,
}: {
  report: SkillGapReport;
  /** Report rows after the page's search and department filters. */
  rows: EmployeeSkillGapRow[];
  canEdit: boolean;
  canSetTargets: boolean;
  onSetTargets: () => void;
  onOpenGap: (row: EmployeeSkillGapRow, item: SkillGapItem) => void;
}) {
  const { summary } = report;

  if (summary.designationsWithTargets === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <Target className="h-8 w-8 text-muted" />
        <p className="max-w-md text-sm text-secondary">
          No role targets yet. Set the level each designation should reach in each skill, and everyone holding that
          designation is compared against it here.
        </p>
        {canSetTargets ? (
          <Button onClick={onSetTargets}>
            <Target className="h-4 w-4" /> Set role targets
          </Button>
        ) : null}
      </div>
    );
  }

  const maxBySkill = Math.max(1, ...report.skills.map((row) => row.belowCount + row.notAssessedCount));

  return (
    <div className="space-y-5 p-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<Users className="h-5 w-5" />}
          tone="accent"
          value={String(summary.employeesWithTargets)}
          label="Employees with targets"
          hint={`${summary.designationsWithTargets} ${summary.designationsWithTargets === 1 ? 'designation' : 'designations'} have targets`}
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          value={String(summary.employeesMeetingAll)}
          label="Meeting every target"
          hint="At or above the target in each skill"
        />
        <SummaryTile
          icon={<TrendingDown className="h-5 w-5" />}
          tone="warning"
          value={String(summary.openGaps)}
          label="Open gaps"
          hint="Below target or not yet assessed"
        />
        <SummaryTile
          icon={<UserX className="h-5 w-5" />}
          tone="neutral"
          value={String(summary.employeesWithoutTargets)}
          label="Without targets"
          hint="Designation has no targets, or none set"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="overflow-x-auto rounded-lg border border-base scrollbar-thin">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-secondary">No employees match the filters.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="w-40 px-3 py-3">Targets met</th>
                  <th className="px-3 py-3">Gaps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {rows.map((row) => {
                  const gaps = row.items.filter((item) => item.status !== 'met');
                  const percent = Math.round((row.metCount / row.targetCount) * 100);
                  return (
                    <tr key={row.employeeId} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-primary">{row.employeeName}</p>
                        <p className="text-xs text-muted">
                          {row.designationName}
                          {row.departmentName ? ` · ${row.departmentName}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-secondary">
                          {row.metCount} of {row.targetCount}
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]">
                          <div
                            className={`h-full rounded-full ${percent === 100 ? 'bg-success-500' : 'bg-warning-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {gaps.length === 0 ? (
                          <span className="flex items-center gap-1 text-xs text-success-700 dark:text-success-300">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Meets every target
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {gaps.map((item) => (
                              <GapChip
                                key={item.skillId}
                                item={item}
                                onClick={canEdit ? () => onOpenGap(row, item) : undefined}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <aside className="rounded-lg border border-base p-4">
          <h3 className="text-sm font-semibold text-primary">Gaps by skill</h3>
          <p className="mt-0.5 text-xs text-muted">Across everyone with a target, in all departments.</p>
          <ul className="mt-3 space-y-3">
            {report.skills.map((skill) => {
              const open = skill.belowCount + skill.notAssessedCount;
              return (
                <li key={skill.skillId}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-primary">{skill.skillName}</span>
                    <span className="shrink-0 text-muted">
                      {open} of {skill.targetedEmployees}
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]">
                    <div className="bg-warning-500" style={{ width: `${(skill.belowCount / maxBySkill) * 100}%` }} />
                    <div className="bg-warning-200" style={{ width: `${(skill.notAssessedCount / maxBySkill) * 100}%` }} />
                  </div>
                  {open > 0 ? (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {skill.belowCount} below target · {skill.notAssessedCount} not assessed
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-success-700 dark:text-success-300">Everyone meets it</p>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
