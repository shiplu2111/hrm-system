import type { CmsPageVersionDto } from '@hrm/shared-types';
import {
  buildVersionSideBySideDiff,
  computeWordDiff,
  mergeDraftWithServerVersion,
} from './cms-diff-utils';
import type { SystemPageLocaleDraft } from './system-page-editor-utils';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

console.log('--- Running CMS Diff & Conflict Merge Tests ---');

// 1. Word-level diff highlighting (English & Bengali)
const diff = computeWordDiff(
  'Payroll compliance for Bangladesh teams',
  'Automated payroll compliance for Bangladesh & global teams',
);
assert(
  diff.leftTokens.some((t) => t.type === 'removed' && t.text.includes('Payroll')),
  'Left tokens mark replaced word as removed',
);
assert(
  diff.rightTokens.some((t) => t.type === 'added' && t.text.includes('Automated')),
  'Right tokens mark inserted word as added',
);

const bnDiff = computeWordDiff('বাংলাদেশ বেতন নীতি', 'বাংলাদেশ স্বয়ংক্রিয় বেতন নীতি');
assert(
  bnDiff.rightTokens.some((t) => t.type === 'added' && t.text.includes('স্বয়ংক্রিয়')),
  'Bengali inserted word is highlighted',
);
console.log('✓ Word-level diff highlighting passed (EN & BN)');

// 2. Side-by-side version diff
const v1: CmsPageVersionDto = {
  id: 'v1',
  pageId: 'p1',
  versionNumber: 1,
  locale: 'en',
  title: 'Pricing Plans',
  seoTitle: 'Pricing v1',
  seoDescription: 'Simple HR pricing',
  ogImageUrl: null,
  noIndex: false,
  isTranslated: true,
  blocks: [
    { id: 'hero', type: 'heading', props: { level: 1, text: 'Old Headline', align: 'left' } },
    { id: 'body', type: 'rich_text', props: { html: '<p>Start a 7-day trial today.</p>' } },
  ],
  createdAt: '2026-11-26T00:00:00.000Z',
};

const v2: CmsPageVersionDto = {
  ...v1,
  id: 'v2',
  versionNumber: 2,
  seoTitle: 'Pricing v2 Updated',
  blocks: [
    { id: 'hero', type: 'heading', props: { level: 1, text: 'New Headline', align: 'left' } },
    { id: 'body', type: 'rich_text', props: { html: '<p>Start a 14-day trial today.</p>' } },
  ],
};

const sideDiff = buildVersionSideBySideDiff(v1, v2);
assert(sideDiff.changedCount === 3, `Expected 3 changed rows (seoTitle, hero, body), got ${sideDiff.changedCount}`);
assert(sideDiff.rows.find((r) => r.key === 'title')?.changed === false, 'Unchanged title stays unchanged');
console.log('✓ Side-by-side version comparison passed');

// 3. 3-way merge of conflicting editor saves
const baseDraft: SystemPageLocaleDraft = {
  locale: 'en',
  title: 'Pricing Plans',
  seoTitle: 'Pricing v1',
  seoDescription: 'Simple HR pricing',
  ogImageUrl: '',
  canonicalPath: '/pricing',
  noIndex: false,
  blocks: [
    { id: 'hero', type: 'heading', props: { level: 1, text: 'Old Headline', align: 'left' } },
    { id: 'body', type: 'rich_text', props: { html: '<p>Start a 7-day trial today.</p>' } },
  ],
  isTranslated: true,
  translationStatus: 'translated',
  changeNote: '',
  sourceVersionNumber: 1,
};

const localEdited: SystemPageLocaleDraft = {
  ...baseDraft,
  blocks: [
    { id: 'hero', type: 'heading', props: { level: 1, text: 'Local Headline Edit', align: 'left' } },
    baseDraft.blocks[1],
  ],
};

const serverSaved: CmsPageVersionDto = {
  ...v1,
  versionNumber: 2,
  seoDescription: 'Updated SEO description by colleague',
  blocks: [
    v1.blocks[0],
    { id: 'body', type: 'rich_text', props: { html: '<p>Colleague edited body block.</p>' } },
  ],
};

const merged = mergeDraftWithServerVersion({
  localDraft: localEdited,
  baseDraft,
  serverVersion: serverSaved,
});
assert(merged.conflictedFields.length === 0, 'Non-overlapping edits merge with zero conflicts');
assert(
  merged.mergedDraft.seoDescription === 'Updated SEO description by colleague',
  'Auto-pulls non-conflicting server SEO update',
);
assert(
  merged.mergedDraft.blocks[0].type === 'heading' &&
    merged.mergedDraft.blocks[0].props.text === 'Local Headline Edit',
  'Keeps local edit to hero block',
);
assert(
  merged.mergedDraft.blocks[1].type === 'rich_text' &&
    merged.mergedDraft.blocks[1].props.html.includes('Colleague edited body block'),
  'Auto-pulls colleague edit to body block',
);
console.log('✓ 3-way conflict merge passed cleanly');
