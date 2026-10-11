import { assessSkillGap, skillLevelRank } from './skill-gap.rules';

describe('skill gap rules', () => {
  it('ranks levels from none to expert', () => {
    expect(skillLevelRank('none')).toBe(0);
    expect(skillLevelRank('intermediate')).toBe(2);
    expect(skillLevelRank('expert')).toBe(4);
  });

  it('is met at or above the target', () => {
    expect(assessSkillGap('advanced', 'advanced')).toEqual({ status: 'met', gap: 0 });
    expect(assessSkillGap('intermediate', 'expert')).toEqual({ status: 'met', gap: 0 });
  });

  it('counts the levels short of the target', () => {
    expect(assessSkillGap('expert', 'intermediate')).toEqual({ status: 'below', gap: 2 });
    expect(assessSkillGap('beginner', 'none')).toEqual({ status: 'below', gap: 1 });
  });

  it('treats an unrated skill as not assessed, sized from none', () => {
    expect(assessSkillGap('advanced', null)).toEqual({ status: 'not_assessed', gap: 3 });
  });
});
