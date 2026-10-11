import {
  SKILL_PROFICIENCY_LEVELS,
  type SkillGapStatus,
  type SkillProficiencyLevel,
} from '@hrm/shared-types';

/** none = 0 … expert = 4. */
export function skillLevelRank(level: SkillProficiencyLevel): number {
  return SKILL_PROFICIENCY_LEVELS.indexOf(level);
}

/** Compares a rating with a target; an unrated skill counts as `none` for the size of the gap. */
export function assessSkillGap(
  targetLevel: SkillProficiencyLevel,
  currentLevel: SkillProficiencyLevel | null,
): { status: SkillGapStatus; gap: number } {
  const gap = Math.max(0, skillLevelRank(targetLevel) - skillLevelRank(currentLevel ?? 'none'));
  if (currentLevel == null) return { status: 'not_assessed', gap };
  return { status: gap === 0 ? 'met' : 'below', gap };
}
