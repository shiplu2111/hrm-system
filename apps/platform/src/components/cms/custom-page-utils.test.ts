import {
  buildCustomPageTemplateBlocks,
  createDefaultBlock,
  duplicateBlockAt,
  generateSlugFromTitle,
  hasBengaliScript,
  removeBlockAt,
  reorderBlocks,
  transliterateBengaliToSlug,
  validateSlugFormatAndReserved,
} from './custom-page-utils';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- Running Create Page & Custom Block Utils Tests ---');

// 1. English & Bengali title -> slug auto-generation & transliteration
assert(
  generateSlugFromTitle('Winter Payroll Launch 2026!') === 'winter-payroll-launch-2026',
  'English title converts to clean slug',
);
assert(hasBengaliScript('বাংলাদেশ বেতন নীতি') === true, 'Detects Bengali characters');
const bnTranslit = transliterateBengaliToSlug('বাংলাদেশ বেতন ২০২৬');
assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(bnTranslit), `Bengali transliteration is URL-safe ASCII: got "${bnTranslit}"`);
assert(bnTranslit.includes('2026'), 'Bengali digits transliterate to ASCII 2026');
console.log(`✓ Bengali transliteration passed ("বাংলাদেশ বেতন ২০২৬" -> "${bnTranslit}")`);

// 2. Reserved words & format live validation
for (const reserved of ['admin', 'api', 'app', 'platform', 'login', 'signup', 'public', '_next']) {
  const res = validateSlugFormatAndReserved(reserved);
  assert(res.valid === false && res.reserved === true, `Reserved slug "${reserved}" must be rejected`);
}
assert(
  validateSlugFormatAndReserved('Invalid Slug').valid === false,
  'Uppercase / spaces rejected',
);
assert(
  validateSlugFormatAndReserved('winter-payroll-guide').valid === true,
  'Valid kebab-case slug passes',
);
console.log('✓ Reserved & format validation passed');

// 3. Templates
const std = buildCustomPageTemplateBlocks('standard', 'Customer Charter');
assert(std.length === 2 && std[0].type === 'heading' && std[1].type === 'rich_text', 'Standard template builds heading + rich_text');

const landing = buildCustomPageTemplateBlocks('landing', 'Eid Bonus Compliance');
assert(
  landing.length === 5 &&
    landing[0].type === 'heading' &&
    landing[1].type === 'button' &&
    landing[2].type === 'feature_cards' &&
    landing[4].type === 'cta_band',
  'Landing template builds hero + CTA + feature cards + body + closing CTA',
);

const legal = buildCustomPageTemplateBlocks('legal', 'Merchant Agreement');
assert(legal.length === 2 && legal[0].type === 'heading' && legal[1].type === 'rich_text', 'Legal template builds structured clauses');
console.log('✓ Page templates passed');

// 4. Add, Reorder, Duplicate, Remove blocks
const added = [...std, createDefaultBlock('button')];
assert(added.length === 3, 'Add block increases block count');

const reordered = reorderBlocks(added, 2, 0);
assert(reordered[0].type === 'button' && reordered[1].type === 'heading', 'Reorder moves button to index 0');

const duplicated = duplicateBlockAt(reordered, 0);
assert(duplicated.length === 4, 'Duplicate increases block count');
assert(duplicated[0].id !== duplicated[1].id, 'Duplicated block gets unique id');

const removed = removeBlockAt(duplicated, 1);
assert(removed.length === 3, 'Remove decreases block count');
console.log('✓ Add, reorder, duplicate, and remove blocks passed');
