import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, CheckCircle2, Grid3X3, Loader2, Search, Settings2, Star, Users } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  SKILL_PROFICIENCY_LEVELS,
  type EmployeeRecord,
  type EmployeeSkillRecord,
  type SkillRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { SkillCatalogPanel } from '@/components/training/SkillCatalogPanel';
import { SkillLevelModal, type SkillLevelTarget } from '@/components/training/SkillLevelModal';
import { SKILL_LEVEL_CELL, SKILL_LEVEL_SCORE, SKILL_LEVEL_SHORT } from '@/components/training/training-ui';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { formatDateOnly } from '@/lib/currency-display';
import { listEmployees } from '@/lib/employees-api';
import { listEmployeeSkills, listSkills, SKILL_LEVEL_LABELS } from '@/lib/training-api';

const UNCATEGORISED = 'Uncategorised';
const STRONG_SCORE = SKILL_LEVEL_SCORE.advanced;

export function TrainingSkillMatrixPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('training', 'create');
  const canEdit = can('training', 'edit');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [ratings, setRatings] = useState<EmployeeSkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [ratedOnly, setRatedOnly] = useState(false);

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [target, setTarget] = useState<SkillLevelTarget | null>(null);

  const reloadMatrix = useCallback(async () => {
    if (!companyId) return;
    const [skillRows, ratingRows] = await Promise.all([listSkills(companyId), listEmployeeSkills(companyId)]);
    setSkills(skillRows);
    setRatings(ratingRows);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    Promise.all([listEmployees(companyId), reloadMatrix()])
      .then(([employeeRows]) => setEmployees(employeeRows))
      .catch((err) => setError(errorMessage(err, 'Couldn’t load the skill matrix')))
      .finally(() => setLoading(false));
  }, [companyId, reloadMatrix]);

  const afterChange = (message: string) => {
    setNotice(message);
    void reloadMatrix().catch((err) => setError(errorMessage(err, 'Couldn’t refresh the skill matrix')));
  };

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((row) => row.employmentStatus !== 'terminated')
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );

  const ratingAt = useMemo(() => {
    const map = new Map<string, EmployeeSkillRecord>();
    for (const row of ratings) map.set(`${row.employeeId}:${row.skillId}`, row);
    return map;
  }, [ratings]);

  const categories = useMemo(
    () => [...new Set(skills.map((row) => row.category ?? UNCATEGORISED))].sort((a, b) =>
      a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b),
    ),
    [skills],
  );
  const departments = useMemo(
    () =>
      [...new Set(activeEmployees.map((row) => row.department?.name).filter((v): v is string => !!v))].sort(),
    [activeEmployees],
  );

  /** Columns, grouped by category in display order. */
  const columns = useMemo(() => {
    const visibleSkills = skills.filter((row) => !category || (row.category ?? UNCATEGORISED) === category);
    return categories
      .map((name) => ({
        name,
        skills: visibleSkills
          .filter((row) => (row.category ?? UNCATEGORISED) === name)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.skills.length > 0);
  }, [skills, categories, category]);
  const flatSkills = useMemo(() => columns.flatMap((group) => group.skills), [columns]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeEmployees
      .filter(
        (row) =>
          (!department || row.department?.name === department) &&
          (!term || `${row.fullName} ${row.employeeNumber}`.toLowerCase().includes(term)),
      )
      .map((employee) => ({
        employee,
        rated: flatSkills.filter((skill) => ratingAt.has(`${employee.id}:${skill.id}`)).length,
      }))
      .filter((row) => !ratedOnly || row.rated > 0);
  }, [activeEmployees, department, search, flatSkills, ratingAt, ratedOnly]);

  const stats = useMemo(() => {
    const activeIds = new Set(activeEmployees.map((row) => row.id));
    const live = ratings.filter((row) => activeIds.has(row.employeeId));
    const possible = activeEmployees.length * skills.length;
    return {
      rated: live.length,
      possible,
      assessed: new Set(live.map((row) => row.employeeId)).size,
      coverage: possible > 0 ? Math.round((live.length / possible) * 100) : null,
      strong: live.filter((row) => SKILL_LEVEL_SCORE[row.level] >= STRONG_SCORE).length,
    };
  }, [activeEmployees, ratings, skills.length]);

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to view the skill matrix.</div>;
  }

  const filtersActive = !!(search || department || category || ratedOnly);
  const openCell = (employee: EmployeeRecord, skill: SkillRecord) => {
    if (!canEdit) return;
    setTarget({
      employeeId: employee.id,
      employeeName: employee.fullName,
      skill,
      rating: ratingAt.get(`${employee.id}:${skill.id}`) ?? null,
    });
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Skill matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Each employee’s proficiency in each skill.{' '}
            {canEdit ? 'Click a cell to set or change a level.' : 'Ask an HR admin to update levels.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('training-certifications')}>
            <Award className="h-4 w-4" /> Certification tracker
          </Button>
          <Button variant={skills.length === 0 ? 'primary' : 'secondary'} onClick={() => setCatalogOpen(true)}>
            <Settings2 className="h-4 w-4" /> {canCreate || canEdit ? 'Manage skills' : 'Skill catalog'}
          </Button>
        </div>
      </header>

      {error ? (
        <Banner icon={AlertCircle} tone="error">
          {error}
        </Banner>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-900 dark:bg-success-950/30 dark:text-success-300"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<Grid3X3 className="h-5 w-5" />}
          tone="accent"
          value={String(skills.length)}
          label="Skills tracked"
          hint={`${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`}
          onClick={() => setCatalogOpen(true)}
        />
        <SummaryTile
          icon={<Users className="h-5 w-5" />}
          tone="neutral"
          value={`${stats.assessed} / ${activeEmployees.length}`}
          label="Employees assessed"
          hint="With at least one rating"
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="neutral"
          value={stats.coverage == null ? '—' : `${stats.coverage}%`}
          label="Matrix filled in"
          hint={`${stats.rated} of ${stats.possible} cells rated`}
        />
        <SummaryTile
          icon={<Star className="h-5 w-5" />}
          tone="success"
          value={String(stats.strong)}
          label="Advanced or expert"
          hint="Ratings at level 3 or 4"
        />
      </div>

      <section className="surface rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-2 border-b border-base p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search employees"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
            <Select className="lg:w-44" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select className="lg:w-44" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Skill category">
              <option value="">All skill categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-secondary">
              <input type="checkbox" checked={ratedOnly} onChange={(e) => setRatedOnly(e.target.checked)} />
              Hide unrated employees
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-base px-5 py-2 text-xs text-secondary">
          <span className="mr-1">Levels:</span>
          {SKILL_PROFICIENCY_LEVELS.map((level) => (
            <span key={level} className={`rounded-sm px-2 py-0.5 font-medium ${SKILL_LEVEL_CELL[level]}`}>
              {SKILL_LEVEL_SCORE[level]} · {SKILL_LEVEL_LABELS[level]}
            </span>
          ))}
          <span className="rounded-sm border border-dashed border-base px-2 py-0.5 text-muted">— Not assessed</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading the skill matrix…
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Grid3X3 className="h-8 w-8 text-muted" />
            <p className="text-sm text-secondary">No skills in the catalog yet. Add skills to build the matrix.</p>
            {canCreate ? (
              <Button onClick={() => setCatalogOpen(true)}>
                <Settings2 className="h-4 w-4" /> Manage skills
              </Button>
            ) : null}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Users className="h-8 w-8 text-muted" />
            <p className="text-sm text-secondary">
              {activeEmployees.length === 0 ? 'No employees yet.' : 'No employees match the filters.'}
            </p>
            {filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setDepartment('');
                  setCategory('');
                  setRatedOnly(false);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="border-separate border-spacing-0 text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th
                    rowSpan={2}
                    className="surface sticky left-0 z-10 min-w-[240px] border-b border-r border-base px-5 py-2 text-left align-bottom"
                  >
                    Employee
                  </th>
                  {columns.map((group) => (
                    <th
                      key={group.name}
                      colSpan={group.skills.length}
                      className="border-b border-l border-base bg-[rgb(var(--bg-muted))] px-2 py-1.5 text-center"
                    >
                      {group.name}
                    </th>
                  ))}
                  <th rowSpan={2} className="border-b border-l border-base px-3 py-2 text-right align-bottom">
                    Rated
                  </th>
                </tr>
                <tr>
                  {columns.map((group) =>
                    group.skills.map((skill, index) => (
                      <th
                        key={skill.id}
                        title={skill.description ?? skill.name}
                        className={`w-24 min-w-[96px] max-w-[96px] border-b border-base px-1.5 py-2 text-center align-bottom font-medium normal-case tracking-normal text-primary ${
                          index === 0 ? 'border-l' : ''
                        }`}
                      >
                        <span className="line-clamp-2 text-xs">{skill.name}</span>
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee, rated }) => (
                  <tr key={employee.id} className="group">
                    <td className="surface sticky left-0 z-10 border-b border-r border-base px-5 py-2 group-hover:bg-[rgb(var(--bg-hover))]">
                      <p className="font-medium text-primary">{employee.fullName}</p>
                      <p className="truncate text-xs text-muted">
                        {employee.employeeNumber}
                        {employee.department ? ` · ${employee.department.name}` : ''}
                      </p>
                    </td>
                    {columns.map((group) =>
                      group.skills.map((skill, index) => {
                        const rating = ratingAt.get(`${employee.id}:${skill.id}`);
                        const label = rating
                          ? `${employee.fullName} · ${skill.name}: ${SKILL_LEVEL_LABELS[rating.level]}${
                              rating.assessedAt ? `, assessed ${formatDateOnly(rating.assessedAt)}` : ''
                            }`
                          : `${employee.fullName} · ${skill.name}: not assessed`;
                        return (
                          <td
                            key={skill.id}
                            className={`border-b border-base p-1 text-center group-hover:bg-[rgb(var(--bg-hover))] ${
                              index === 0 ? 'border-l' : ''
                            }`}
                          >
                            <button
                              type="button"
                              title={label}
                              aria-label={label}
                              disabled={!canEdit}
                              onClick={() => openCell(employee, skill)}
                              className={`flex h-9 w-full items-center justify-center rounded-sm text-xs font-medium transition ${
                                rating
                                  ? SKILL_LEVEL_CELL[rating.level]
                                  : 'border border-dashed border-base text-muted'
                              } ${canEdit ? 'hover:ring-2 hover:ring-accent-400 focus-visible:ring-2 focus-visible:ring-accent-500' : 'cursor-default'}`}
                            >
                              {rating ? SKILL_LEVEL_SHORT[rating.level] : '—'}
                            </button>
                          </td>
                        );
                      }),
                    )}
                    <td className="border-b border-l border-base px-3 py-2 text-right text-xs text-secondary group-hover:bg-[rgb(var(--bg-hover))]">
                      {rated} / {flatSkills.length}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-xs text-secondary">
                <tr>
                  <td className="surface sticky left-0 z-10 border-r border-base px-5 py-2 font-medium">
                    Advanced or expert
                    <span className="block font-normal text-muted">of rated, in this view</span>
                  </td>
                  {columns.map((group) =>
                    group.skills.map((skill, index) => {
                      const cellRatings = rows
                        .map(({ employee }) => ratingAt.get(`${employee.id}:${skill.id}`))
                        .filter((row): row is EmployeeSkillRecord => !!row);
                      const strong = cellRatings.filter((row) => SKILL_LEVEL_SCORE[row.level] >= STRONG_SCORE).length;
                      return (
                        <td key={skill.id} className={`border-base px-1.5 py-2 text-center ${index === 0 ? 'border-l' : ''}`}>
                          <span className={strong > 0 ? 'font-semibold text-primary' : 'text-muted'}>{strong}</span>
                          <span className="text-muted"> / {cellRatings.length}</span>
                        </td>
                      );
                    }),
                  )}
                  <td className="border-l border-base" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <SkillCatalogPanel
        open={catalogOpen}
        companyId={companyId}
        skills={skills}
        canCreate={canCreate}
        canEdit={canEdit}
        onClose={() => setCatalogOpen(false)}
        onChanged={afterChange}
      />

      <SkillLevelModal
        target={target}
        companyId={companyId}
        onClose={() => setTarget(null)}
        onSaved={(message) => {
          setTarget(null);
          afterChange(message);
        }}
      />
    </div>
  );
}
