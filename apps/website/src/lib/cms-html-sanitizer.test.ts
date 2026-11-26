import assert from 'node:assert/strict';
import { isSafeCmsHref, isSafeCmsImageSrc, sanitizeCmsRenderHtml } from './cms-html-sanitizer';

function runSanitizerTests(): void {
  // 1. Strips script, iframe, svg, form, style tags
  const xssHtml =
    '<p>Hello <strong>World</strong></p><script>alert(1)</script><iframe src="https://evil.test"></iframe><svg onload="alert(2)"><circle /></svg><style>body{display:none}</style>';
  const cleanedXss = sanitizeCmsRenderHtml(xssHtml);
  assert.equal(cleanedXss, '<p>Hello <strong>World</strong></p>');

  // 2. Strips inline event handlers & javascript: / data: URIs
  const attrHtml =
    '<a href="javascript:alert(1)" onclick="steal()">Bad</a> <a href="https://example.com" target="_blank">Good</a> <img src="data:text/html,<script>1</script>" onerror="alert(3)" alt="bad" /> <img src="/api/v1/public/content/media/1/file" alt="ok" />';
  const cleanedAttr = sanitizeCmsRenderHtml(attrHtml);
  assert.ok(!cleanedAttr.includes('javascript:'), 'javascript: href must be removed');
  assert.ok(!cleanedAttr.includes('onclick'), 'onclick handler must be removed');
  assert.ok(!cleanedAttr.includes('onerror'), 'onerror handler must be removed');
  assert.ok(!cleanedAttr.includes('data:text/html'), 'data: src must be removed');
  assert.ok(cleanedAttr.includes('href="https://example.com"'));
  assert.ok(cleanedAttr.includes('rel="noopener noreferrer"'));
  assert.ok(cleanedAttr.includes('src="/api/v1/public/content/media/1/file"'));

  // 3. Entity-obfuscated javascript URI check
  assert.equal(isSafeCmsHref('&#106;avascript:alert(1)'), false);
  assert.equal(isSafeCmsHref('https://hrm.example/pricing'), true);
  assert.equal(isSafeCmsHref('/en/pricing'), true);
  assert.equal(isSafeCmsHref('//evil.example.com'), false);
  assert.equal(isSafeCmsImageSrc('javascript:alert(1)'), false);
  assert.equal(isSafeCmsImageSrc('https://cdn.example.com/a.webp'), true);

  // 4. Nested obfuscated script tag stripped cleanly
  const nested = '<scr<script>ipt>alert(1)</script><p>Safe</p>';
  const cleanedNested = sanitizeCmsRenderHtml(nested);
  assert.ok(!cleanedNested.includes('alert(1)') || !cleanedNested.includes('<script'));
  assert.ok(cleanedNested.includes('<p>Safe</p>'));

  // 5. Preserves safe formatting, tables, headings, lists
  const richHtml = '<h2>Summary</h2><ul><li>Item <em>one</em></li></ul><table><thead><tr><th scope="col">Plan</th></tr></thead><tbody><tr><td>Growth</td></tr></tbody></table>';
  assert.equal(sanitizeCmsRenderHtml(richHtml), richHtml);

  console.log('All cms-html-sanitizer tests passed.');
}

runSanitizerTests();
