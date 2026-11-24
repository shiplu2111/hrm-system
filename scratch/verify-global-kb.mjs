// scratch/verify-global-kb.mjs
const API_URL = 'http://localhost:3000/api/v1';

async function run() {
  console.log('🚀 Starting Global Knowledge Base Verification Script...\n');

  // Step 1: Login as Platform Owner
  console.log('1. Logging in as Platform Owner...');
  const loginRes = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken || loginData.accessToken;
  if (!token) {
    throw new Error(`No access token returned: ${JSON.stringify(loginData)}`);
  }
  console.log('✅ Successfully authenticated as Platform Owner.\n');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Step 2: Fetch categories (seeded on bootstrap)
  console.log('2. Fetching Global KB categories...');
  const catRes = await fetch(`${API_URL}/platform/knowledge-base/categories`, {
    headers: authHeaders,
  });
  if (!catRes.ok) {
    throw new Error(`Failed to fetch categories: ${catRes.status} ${await catRes.text()}`);
  }
  const catData = await catRes.json();
  const categories = catData.data || catData;
  console.log(`✅ Retrieved ${categories.length} categories:`);
  for (const c of categories) {
    console.log(`   - [${c.icon}] ${c.name} (${c.articleCount} articles, published: ${c.publishedCount})`);
  }
  if (categories.length === 0) {
    throw new Error('Expected seeded categories, but found 0!');
  }

  // Step 3: Test Category Creation & Deletion Safeguard
  console.log('\n3. Testing Category creation & deletion protection when containing articles...');
  const newCatRes = await fetch(`${API_URL}/platform/knowledge-base/categories`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Temporary Test Category',
      description: 'Category created to test deletion protection rules',
      icon: 'FolderSync',
      sortOrder: 99,
    }),
  });
  if (!newCatRes.ok) {
    throw new Error(`Failed to create test category: ${newCatRes.status} ${await newCatRes.text()}`);
  }
  const newCat = (await newCatRes.json()).data;
  console.log(`✅ Created test category: ${newCat.name} (id: ${newCat.id}, slug: ${newCat.slug})`);

  // Step 4: Create a draft article in this new category
  console.log('\n4. Creating a draft article in the test category...');
  const newArtRes = await fetch(`${API_URL}/platform/knowledge-base/articles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      categoryId: newCat.id,
      title: 'Guide to Multi-Entity Payroll Reconciliation',
      summary: 'Best practices for managing month-end multi-currency payroll reconciliation across SG, MY, and US entities.',
      body: '# Multi-Entity Payroll Reconciliation\n\nEnsure statutory accounts balance against bank statements.',
      status: 'draft',
      targetCountries: ['SG', 'MY', 'US'],
      targetPlans: ['ENTERPRISE'],
      tags: ['payroll', 'reconciliation', 'multi-entity'],
    }),
  });
  if (!newArtRes.ok) {
    throw new Error(`Failed to create test article: ${newArtRes.status} ${await newArtRes.text()}`);
  }
  const newArt = (await newArtRes.json()).data;
  console.log(`✅ Created draft article: ${newArt.title} (id: ${newArt.id}, slug: ${newArt.slug})`);

  // Step 5: Attempt to delete category when NOT empty (must fail with 400 Bad Request)
  console.log('\n5. Attempting to delete category while it has an article (safeguard check)...');
  const delBlockedRes = await fetch(`${API_URL}/platform/knowledge-base/categories/${newCat.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (delBlockedRes.status === 409 || delBlockedRes.status === 400) {
    const errorJson = await delBlockedRes.json();
    console.log(`✅ Category deletion correctly blocked (${delBlockedRes.status}): ${errorJson.message || errorJson.error?.message || 'Category is not empty'}`);
  } else {
    throw new Error(`Expected status 409/400 when deleting non-empty category, got ${delBlockedRes.status}`);
  }

  // Step 6: Test preview mode vs view count increment
  console.log('\n6. Testing Preview mode (should NOT increment viewCount)...');
  const initialViewCount = newArt.viewCount || 0;
  const previewRes = await fetch(`${API_URL}/platform/knowledge-base/articles/${newArt.id}?preview=true`, {
    headers: authHeaders,
  });
  const previewArt = (await previewRes.json()).data;
  console.log(`   Initial viewCount: ${initialViewCount}, After preview: ${previewArt.viewCount}`);
  if (previewArt.viewCount !== initialViewCount) {
    throw new Error(`Preview mode incremented view count! Expected ${initialViewCount}, got ${previewArt.viewCount}`);
  }
  console.log('✅ Preview mode respected: viewCount was not incremented.');

  // Step 7: Test explicit view count increment
  console.log('\n7. Testing explicit view count increment...');
  const viewIncRes = await fetch(`${API_URL}/platform/knowledge-base/articles/${newArt.id}/view`, {
    method: 'POST',
    headers: authHeaders,
  });
  if (!viewIncRes.ok) {
    throw new Error(`Failed to increment view: ${viewIncRes.status} ${await viewIncRes.text()}`);
  }
  const incData = (await viewIncRes.json()).data;
  console.log(`✅ View count incremented: now ${incData.viewCount}`);
  if (incData.viewCount !== initialViewCount + 1) {
    throw new Error(`Expected viewCount ${initialViewCount + 1}, got ${incData.viewCount}`);
  }

  // Step 8: Update article status to published and query with country/plan filters
  console.log('\n8. Publishing article and testing search & visibility filtering...');
  const updateRes = await fetch(`${API_URL}/platform/knowledge-base/articles/${newArt.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'published',
    }),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update article: ${updateRes.status} ${await updateRes.text()}`);
  }
  const updatedArt = (await updateRes.json()).data;
  console.log(`✅ Updated article status to: ${updatedArt.status}`);

  // Query articles with search
  const searchRes = await fetch(`${API_URL}/platform/knowledge-base/articles?search=Reconciliation`, {
    headers: authHeaders,
  });
  const searchResults = (await searchRes.json()).data.items;
  console.log(`✅ Search for 'Reconciliation' returned ${searchResults.length} articles`);
  if (!searchResults.some((a) => a.id === newArt.id)) {
    throw new Error('Created article not found in search results!');
  }

  // Query articles with country filter SG
  const sgRes = await fetch(`${API_URL}/platform/knowledge-base/articles?country=SG`, {
    headers: authHeaders,
  });
  const sgResults = (await sgRes.json()).data.items;
  console.log(`✅ Filter for country 'SG' returned ${sgResults.length} articles`);
  if (!sgResults.some((a) => a.id === newArt.id)) {
    throw new Error('Created SG article not found in SG country filter!');
  }

  // Step 9: Cleanup test article and test category
  console.log('\n9. Cleaning up test article and test category...');
  const delArtRes = await fetch(`${API_URL}/platform/knowledge-base/articles/${newArt.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (!delArtRes.ok) {
    throw new Error(`Failed to delete test article: ${delArtRes.status}`);
  }
  console.log('✅ Deleted test article.');

  const delCatRes = await fetch(`${API_URL}/platform/knowledge-base/categories/${newCat.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (!delCatRes.ok) {
    throw new Error(`Failed to delete empty test category: ${delCatRes.status}`);
  }
  console.log('✅ Deleted empty test category.');

  console.log('\n🎉 ALL GLOBAL KNOWLEDGE BASE VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
