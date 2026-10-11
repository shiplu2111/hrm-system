import {
  apply360Ratings,
  competencyRatingsView,
  compute360Summary,
  missing360Ratings,
  normalize360Summary,
  parseCompetencyRatings,
} from './performance-360.utils';

const rated = (impact: number, ownership: number, collaboration: number, craft: number) => [
  { key: 'impact', rating: impact },
  { key: 'ownership', rating: ownership },
  { key: 'collaboration', rating: collaboration },
  { key: 'craft', rating: craft },
];

describe('360 ratings', () => {
  it('treats legacy zero ratings as unrated', () => {
    expect(parseCompetencyRatings([{ key: 'impact', rating: 0 }])).toEqual([{ key: 'impact', rating: null }]);
    expect(competencyRatingsView([]).every((item) => item.rating === null)).toBe(true);
  });

  it('applies changes by key and keeps the rest', () => {
    const next = apply360Ratings(rated(4, 4, 4, 4), [{ key: 'craft', rating: 2 }, { key: 'impact', rating: null }]);
    expect(next).toEqual([
      { key: 'impact', rating: null },
      { key: 'ownership', rating: 4 },
      { key: 'collaboration', rating: 4 },
      { key: 'craft', rating: 2 },
    ]);
    expect(missing360Ratings(next)).toEqual(['Business impact']);
  });

  it('rejects unknown competencies', () => {
    expect(() => apply360Ratings([], [{ key: 'charisma', rating: 5 }])).toThrow(
      '"charisma" is not a competency on this feedback form',
    );
  });
});

describe('compute360Summary', () => {
  it('shows nothing until enough responses are in', () => {
    const summary = compute360Summary([
      { relationship: 'peer', status: 'submitted', competencyRatings: rated(5, 5, 5, 5), comment: 'Great' },
      { relationship: 'peer', status: 'pending', competencyRatings: [], comment: null },
    ]);
    expect(summary).toMatchObject({ responseCount: 1, invitedCount: 2, visible: false, averageRating: null, comments: [] });
    expect(summary.competencyAverages.every((item) => item.averageRating === null)).toBe(true);
  });

  it('averages responses and hides groups with a single response', () => {
    const summary = compute360Summary([
      { relationship: 'peer', status: 'submitted', competencyRatings: rated(4, 4, 4, 4), comment: 'Zesty' },
      { relationship: 'peer', status: 'submitted', competencyRatings: rated(5, 5, 5, 5), comment: null },
      { relationship: 'cross_functional', status: 'submitted', competencyRatings: rated(3, 3, 3, 3), comment: 'Able' },
    ]);
    expect(summary.visible).toBe(true);
    expect(summary.averageRating).toBe(4);
    expect(summary.byRelationship.peer).toEqual({ responseCount: 2, averageRating: 4.5, hidden: false });
    expect(summary.byRelationship.cross_functional).toEqual({ responseCount: 1, averageRating: null, hidden: true });
    expect(summary.byRelationship.direct_report).toEqual({ responseCount: 0, averageRating: null, hidden: false });
    expect(summary.comments).toEqual(['Able', 'Zesty']);
  });

  it('redacts summaries stored in the old format', () => {
    const legacy = normalize360Summary({
      responseCount: 2,
      invitedCount: 2,
      averageRating: 4.25,
      competencyAverages: [{ key: 'impact', label: 'Business impact', averageRating: 4 }],
      byRelationship: {
        peer: { responseCount: 1, averageRating: 4.25, comments: ['B'] },
        cross_functional: { responseCount: 1, averageRating: 4.25, comments: ['A'] },
      },
    });
    expect(legacy).toMatchObject({ visible: true, averageRating: 4.25, comments: ['A', 'B'] });
    expect(legacy?.byRelationship.peer).toEqual({ responseCount: 1, averageRating: null, hidden: true });
  });
});
