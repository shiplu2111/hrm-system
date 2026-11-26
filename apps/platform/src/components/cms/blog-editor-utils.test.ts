import {
  collectBlogPostWarnings,
  estimateBlogReadingTimeMinutes,
  generateBlogSlugFromTitle,
  getBlogSeoLengthHint,
  parseBlogTagsInput,
} from './blog-editor-utils';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- Running Blog Editor Utility Tests ---');

// 1. Reading time calculation
assert(estimateBlogReadingTimeMinutes('<p>Hello world</p>') === 1, 'Short post min 1m');
const longBody = `<p>${Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ')}</p>`;
assert(estimateBlogReadingTimeMinutes(longBody) === 2, '450 words = 2m');
assert(
  estimateBlogReadingTimeMinutes(
    '<p>Short EN</p>',
    `<p>${Array.from({ length: 610 }, () => 'শব্দ').join(' ')}</p>`,
  ) === 3,
  '610 BN words = 3m',
);
console.log('✓ Reading time estimation passed');

// 2. Slug generation (EN & BN transliteration)
assert(
  generateBlogSlugFromTitle('Deterministic Payroll & Tax Rules!') ===
    'deterministic-payroll-tax-rules',
  'English slug generation',
);
assert(
  generateBlogSlugFromTitle('বাংলাদেশ বেতন ২০২৬') === 'bangladesh-beton-2026',
  'Bengali transliterated slug generation',
);
console.log('✓ Blog slug generation passed');

// 3. Tags parser
assert(
  JSON.stringify(parseBlogTagsInput('Payroll, Compliance, payroll , HR-Tech ')) ===
    JSON.stringify(['payroll', 'compliance', 'hr-tech']),
  'Tags normalization & dedup',
);
console.log('✓ Tags normalization passed');

// 4. SEO hints & validation warnings
assert(
  getBlogSeoLengthHint('Optimal SEO Title For HRM SaaS Platform Blog', 'title').status === 'ok',
  'Optimal SEO title length check',
);
const warnings = collectBlogPostWarnings({
  titleEn: 'Test Post',
  slug: 'test-post',
  excerptEn: 'Summary',
  bodyHtmlEn: '<p>Body</p>',
  categoryId: 'c1',
  authorId: 'a1',
  coverMediaId: 'm1',
  coverAltEn: '',
});
assert(warnings.length === 1 && warnings[0].includes('alt text'), 'Cover alt warning check');
console.log('✓ SEO hint and cover alt warning checks passed');
