import {
  countWordsAndChars,
  plainTextToSafeHtml,
  stripWordAndWebPasteJunk,
  validateCmsLinkInput,
} from './rich-text-utils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? `${message}: ` : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

console.log('--- Running RichTextEditor Utility Tests ---');

// 1. Link URL validation
assertEqual(validateCmsLinkInput('https://cmsnbd.com/pricing').valid, true);
assertEqual(validateCmsLinkInput('http://example.com').valid, true);
assertEqual(validateCmsLinkInput('/features#payroll').valid, true);
assertEqual(validateCmsLinkInput('#faq').valid, true);
assertEqual(validateCmsLinkInput('mailto:sales@cmsnbd.com').valid, true);

assertEqual(validateCmsLinkInput('').valid, false);
assertEqual(validateCmsLinkInput('javascript:alert(1)').valid, false);
assertEqual(validateCmsLinkInput('JaVaScRiPt:alert(document.cookie)').valid, false);
assertEqual(validateCmsLinkInput('vbscript:msgbox(1)').valid, false);
assertEqual(validateCmsLinkInput('data:text/html,<script>alert(1)</script>').valid, false);
assertEqual(validateCmsLinkInput('//evil.example/phish').valid, false);
console.log('✓ Link URL validation passed');

// 2. Microsoft Word & Web page paste junk stripping
const wordHtml = `
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]-->
  <style>.MsoNormal{font-family:Calibri}</style>
  <h2 class="MsoHeading2" style="mso-margin-top-alt:auto;color:red" onclick="alert(1)">Section Title<o:p></o:p></h2>
  <p class="MsoNormal" style="font-family:'Times New Roman';background:yellow">
    <span style="mso-spacerun:yes">&nbsp;&nbsp;</span>Formatted <b style="mso-bidi-font-weight:normal">bold</b>,
    <u style="text-decoration:underline">underlined</u>, and
    <a href="javascript:alert(1)" style="color:blue">bad link</a> or
    <a href="https://cmsnbd.com/docs" target="_blank" style="color:green">docs</a>.
  </p>
  <p class="MsoListParagraph" style="margin-left:36pt"><span>·&nbsp;&nbsp;</span>First bullet</p>
  <p class="MsoListParagraph" style="margin-left:36pt"><span>·&nbsp;&nbsp;</span>Second bullet</p>
  <script>alert("xss")</script>
  <img src="x" onerror="alert(1)">
  <img src="/api/v1/public/content/media/550e8400-e29b-41d4-a716-446655440000/file" alt="Valid Asset" style="border:1px solid red">
`;

const cleanedWord = stripWordAndWebPasteJunk(wordHtml);
assert(!cleanedWord.includes('MsoNormal'), 'Must strip Word classes');
assert(!cleanedWord.includes('mso-'), 'Must strip mso styles');
assert(!cleanedWord.includes('style='), 'Must strip inline styles');
assert(!cleanedWord.includes('<o:p'), 'Must strip Office XML tags');
assert(!cleanedWord.includes('<script'), 'Must strip scripts');
assert(!cleanedWord.includes('javascript:'), 'Must strip javascript: href');
assert(!cleanedWord.includes('onerror'), 'Must strip unsafe image handlers');
assert(cleanedWord.includes('<h2>Section Title</h2>'), 'Must preserve headings cleanly');
assert(cleanedWord.includes('<b>bold</b>'), 'Must preserve bold');
assert(cleanedWord.includes('<u>underlined</u>'), 'Must preserve underline');
assert(cleanedWord.includes('<ul><li>First bullet</li><li>Second bullet</li></ul>'), 'Must normalize Word list paragraphs');
assert(
  cleanedWord.includes('<a href="https://cmsnbd.com/docs" rel="noopener noreferrer" target="_blank">docs</a>'),
  'Must force rel=noopener noreferrer on safe links',
);
assert(
  cleanedWord.includes('<img src="/api/v1/public/content/media/550e8400-e29b-41d4-a716-446655440000/file" alt="Valid Asset">'),
  'Must keep verified CMS Media Library image with alt text',
);
console.log('✓ Word & web paste cleanup passed');

// 3. Plain-text paste conversion
const plainHtml = plainTextToSafeHtml('Hello <script>alert(1)</script>\nLine 2\n\nNext paragraph');
assertEqual(
  plainHtml,
  '<p>Hello &lt;script&gt;alert(1)&lt;/script&gt;<br>Line 2</p><p>Next paragraph</p>',
);
console.log('✓ Plain-text paste escaping passed');

// 4. Bengali Unicode word & grapheme counting
const bnCounts = countWordsAndChars('বাংলাদেশ এইচআর সিস্টেম', 'bn');
assertEqual(bnCounts.words, 3);
assert(bnCounts.characters > 10 && bnCounts.characters <= 25, 'Expected grapheme count for Bengali text');
console.log('✓ Bengali Unicode word/grapheme counts passed', bnCounts);
