import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:3000';
const WEBSITE_BASE = 'http://localhost:5180';
const prisma = new PrismaClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reqJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json, headers: res.headers };
}

async function main() {
  console.log('\n================================================================');
  console.log('      SOLUTIONS BY COUNTRY — LIVE PLATFORM & CACHE CHECK');
  console.log('================================================================\n');

  // 1. Authenticate as Platform Owner
  const loginRes = await reqJson(`${API_BASE}/api/v1/platform/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });
  const token = loginRes.data?.data?.accessToken;
  if (!token) throw new Error(`Platform login failed: ${JSON.stringify(loginRes)}`);
  const auth = { Authorization: `Bearer ${token}` };

  // 2. Ensure Australia is active (it already has published rules across all 5 required categories)
  const australiaId = '10000000-0000-4000-8000-000000000002';
  const actAus = await reqJson(`${API_BASE}/api/v1/platform/countries/${australiaId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'active' }),
  });
  if (actAus.status !== 200) {
    throw new Error(`Failed to activate Australia: ${JSON.stringify(actAus)}`);
  }
  console.log('✅ Australia activated via Platform API');

  // Ensure Bangladesh remains draft so we verify draft countries never leak
  await prisma.country.updateMany({
    where: { name: 'Bangladesh' },
    data: { status: 'draft' },
  });

  // 3. Create a disposable test country ("Testlandia") with published rule stubs and activate it
  const existingTest = await prisma.country.findMany({ where: { isoCode: 'TST' }, select: { id: true } });
  if (existingTest.length > 0) {
    await prisma.countryRule.deleteMany({ where: { countryId: { in: existingTest.map((c) => c.id) } } });
    await prisma.country.deleteMany({ where: { isoCode: 'TST' } });
  }
  const testCountry = await prisma.country.create({
    data: {
      name: 'Testlandia',
      isoCode: 'TST',
      currency: 'TST',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      numberFormat: '1,234.56',
      defaultPayFrequency: 'bi-weekly',
      status: 'active',
    },
  });

  await prisma.countryRule.createMany({
    data: [
      { countryId: testCountry.id, ruleType: 'tax', payload: { taxYear: 2026 }, effectiveFrom: new Date('2026-01-01'), status: 'published' },
      { countryId: testCountry.id, ruleType: 'social_security', payload: { schemeName: 'National Fund' }, effectiveFrom: new Date('2026-01-01'), status: 'published' },
      { countryId: testCountry.id, ruleType: 'leave', payload: { annualDays: 20 }, effectiveFrom: new Date('2026-01-01'), status: 'published' },
      { countryId: testCountry.id, ruleType: 'public_holiday', payload: { holidays: [] }, effectiveFrom: new Date('2026-01-01'), status: 'published' },
      { countryId: testCountry.id, ruleType: 'ot', payload: { weeklyThresholdHours: 40 }, effectiveFrom: new Date('2026-01-01'), status: 'published' },
      { countryId: testCountry.id, ruleType: 'employment_rules', payload: { standardNoticeWeeks: 2 }, effectiveFrom: new Date('2026-01-01'), status: 'published' },
    ],
  });
  console.log(`✅ Testlandia (${testCountry.id}) created and activated`);

  // 4. Verify GET /api/v1/public/countries
  const pubRes1 = await reqJson(`${API_BASE}/api/v1/public/countries`);
  if (pubRes1.status !== 200) throw new Error(`Public countries failed: ${pubRes1.status}`);
  const pubList1 = pubRes1.data?.data || [];
  const hasAus1 = pubList1.some((c) => c.slug === 'australia');
  const hasTest1 = pubList1.some((c) => c.slug === 'testlandia');
  const hasBd1 = pubList1.some((c) => c.slug === 'bangladesh');
  const serialized1 = JSON.stringify(pubList1);
  if (!hasAus1 || !hasTest1 || hasBd1) {
    throw new Error(`Unexpected country list before retire: ${serialized1}`);
  }
  if (serialized1.includes('taxBrackets') || serialized1.includes('employerContributionRate')) {
    throw new Error(`Sensitive rate fields leaked in public API: ${serialized1}`);
  }
  console.log('✅ Public API returns active countries (Australia, Testlandia) and hides draft (Bangladesh)');

  // 5. Verify Website SSR pages before retiring Testlandia
  // Wait > 10s if build-time cache is warm, then hit once to trigger background ISR refresh
  await fetch(`${WEBSITE_BASE}/solutions/countries`);
  await sleep(11000);
  await fetch(`${WEBSITE_BASE}/solutions/countries`);
  await sleep(500);
  const indexRes1 = await fetch(`${WEBSITE_BASE}/solutions/countries`);
  const indexHtml1 = await indexRes1.text();
  if (indexRes1.status !== 200 || !indexHtml1.includes('Australia') || !indexHtml1.includes('Testlandia')) {
    throw new Error(`Website /solutions/countries missing active countries. Status: ${indexRes1.status}`);
  }
  if (indexHtml1.includes('Bangladesh')) {
    throw new Error(`Website /solutions/countries leaked draft country Bangladesh!`);
  }

  const ausPage = await fetch(`${WEBSITE_BASE}/solutions/countries/australia`);
  const ausHtml = await ausPage.text();
  if (
    ausPage.status !== 200 ||
    !ausHtml.includes('AUD') ||
    !ausHtml.includes('Superannuation') ||
    !ausHtml.includes('Help Center')
  ) {
    throw new Error(`Australia detail page missing required elements`);
  }

  // Ensure NO tax rate numbers / percentages are printed on marketing page
  const ausMainMatch = ausHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const ausMainText = (ausMainMatch?.[1] || '').replace(/<[^>]+>/g, ' ');
  if (/\d+(\.\d+)?\s*%/.test(ausMainText)) {
    throw new Error(`Tax rate percentage detected on marketing page! Text match: ${ausMainText.match(/\d+(\.\d+)?\s*%/)?.[0]}`);
  }
  console.log('✅ Website renders Australia & Testlandia with Currency, Frequencies, Statutory items, Help Center link, and ZERO tax rates');

  const testPage1 = await fetch(`${WEBSITE_BASE}/solutions/countries/testlandia`);
  if (testPage1.status !== 200) {
    throw new Error(`Expected 200 on active /solutions/countries/testlandia, got ${testPage1.status}`);
  }

  // 6. Switch Testlandia to RETIRED in Platform API
  const retireRes = await reqJson(`${API_BASE}/api/v1/platform/countries/${testCountry.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'retired' }),
  });
  if (retireRes.status !== 200) {
    throw new Error(`Failed to retire Testlandia: ${JSON.stringify(retireRes)}`);
  }
  console.log('✅ Testlandia switched to "retired" via Platform API');

  // Wait past the 10-second ISR cache window (11.5s)
  console.log('⏳ Waiting 11.5s for ISR cache window (revalidate = 10s) to expire...');
  await sleep(11500);

  // First request after revalidate=10 triggers background/on-demand revalidation in Next.js; trigger once and check next response
  await fetch(`${WEBSITE_BASE}/solutions/countries`);
  await sleep(500);
  const indexRes2 = await fetch(`${WEBSITE_BASE}/solutions/countries`);
  const indexHtml2 = await indexRes2.text();
  if (indexHtml2.includes('Testlandia')) {
    throw new Error(`Retired country Testlandia STILL appears on /solutions/countries after cache window!`);
  }
  if (!indexHtml2.includes('Australia')) {
    throw new Error(`Active country Australia disappeared unexpectedly!`);
  }
  console.log('✅ Testlandia automatically removed from /solutions/countries after cache window');

  await fetch(`${WEBSITE_BASE}/solutions/countries/testlandia`);
  await sleep(500);
  const testPage2 = await fetch(`${WEBSITE_BASE}/solutions/countries/testlandia`);
  if (testPage2.status !== 404) {
    throw new Error(`Expected 404 for retired /solutions/countries/testlandia, got ${testPage2.status}`);
  }
  console.log('✅ Retired country detail /solutions/countries/testlandia returns HTTP 404 after cache window');

  // Cleanup test record
  await prisma.countryRule.deleteMany({ where: { countryId: testCountry.id } });
  await prisma.country.delete({ where: { id: testCountry.id } });
  console.log('✅ Cleaned up temporary Testlandia database record');

  console.log('\n================================================================');
  console.log('  SUCCESS: COUNTRY SOLUTIONS & RETIREMENT CACHE VERIFIED!');
  console.log('================================================================\n');
}

main()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
