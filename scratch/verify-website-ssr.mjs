import http from 'http';

const WEBSITE_PORT = 5180;
const WEBSITE_URL = `http://localhost:${WEBSITE_PORT}`;

async function verifySSR() {
  console.log(`\n============================================================`);
  console.log(`       VERIFYING APPS/WEBSITE SSR & SEO MARKUP`);
  console.log(`============================================================\n`);

  console.log(`Connecting to ${WEBSITE_URL}...`);

  const response = await fetch(WEBSITE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  console.log(`Response Status:  ${response.status} ${response.statusText}`);
  const contentType = response.headers.get('content-type') || '';
  console.log(`Content-Type:     ${contentType}`);

  if (response.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${response.status}`);
  }

  const html = await response.text();

  const assertions = [
    {
      name: 'HTML Document Declaration',
      test: html.includes('<!DOCTYPE html>') || html.includes('<html'),
    },
    {
      name: 'Server-Rendered H1 Title (Not client mounted)',
      test: html.includes('Run country-compliant payroll, offline attendance, and HR in one system'),
    },
    {
      name: 'SEO Schema.org JSON-LD Structured Data',
      test: html.includes('application/ld+json') && html.includes('SoftwareApplication'),
    },
    {
      name: 'Four Core Differentiators & Modules Grid',
      test:
        html.includes('Country-Configurable Payroll') &&
        html.includes('Offline-First Mobile Attendance') &&
        html.includes('Dynamic Payroll Rules') &&
        html.includes('Full Audit Trail') &&
        html.includes('How It Works in 3 Steps'),
    },
    {
      name: 'Live Public Health / Telemetry Indicator',
      test: html.includes('Public Platform Health') && html.includes('Live Infrastructure Indicators'),
    },
    {
      name: 'Shared Design Tokens Styling Classes',
      test: html.includes('bg-primary-600') || html.includes('text-primary'),
    },
    {
      name: 'SEO Meta Tags (Description, OpenGraph)',
      test: html.includes('name="description"') && html.includes('og:title'),
    },
    {
      name: 'No Empty SPA Shell',
      test: !html.includes('<div id="root"></div>') && !html.includes('<div id="__next"></div>'),
    },
  ];

  console.log('\n--- Assertion Results ---');
  let allPassed = true;
  for (const { name, test } of assertions) {
    const symbol = test ? '✅' : '❌';
    console.log(`${symbol} ${name}`);
    if (!test) allPassed = false;
  }

  console.log(`\n============================================================`);
  if (!allPassed) {
    console.error('FAIL: One or more SSR assertions failed!');
    process.exit(1);
  } else {
    console.log('SUCCESS: All 8 SSR & SEO assertions passed!');
    console.log(`HTML Payload Size: ${(html.length / 1024).toFixed(2)} KB of fully-rendered markup.`);
  }
}

verifySSR().catch((err) => {
  console.error('Fatal SSR verification error:', err);
  process.exit(1);
});
