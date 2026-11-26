# CURSOR_PROMPT_PLAN_WEBSITE_3_CONTENT_LAUNCH.md

Public website, part 3 of 3: **help center, blog, changelog, status, legal pages, SEO, languages, analytics and consent, final QA and launch.** Finish parts 1 and 2 first.

---

## STAGE H: Resources

**Prompt H.1: Help Center (MVP)**
```
Read /docs/MODULES.md section 45 and Super Admin Stage R.2 (Global Knowledge Base). Build the public
Help Center from the platform's knowledge-base API: category pages, article pages, search (server
side, typo tolerant), "was this helpful" feedback, related articles, and breadcrumbs. Only
articles marked public and published are shown; per-country and per-plan articles stay hidden
from the public site. Include an article template that supports step lists, images and callouts.
```
**Verify:** A draft article and a plan-restricted article do not appear; a published article appears after the cache window and is searchable.

**Prompt H.2: Blog (P2)**
```
Build the Blog: list with categories and pagination, article page with author, date, reading time,
share links, related posts, RSS feed, and an email-subscribe box that stores consent. Content
source: MDX files in the repo for now, behind a content-loading interface so a CMS can replace it
later. Ship with no placeholder posts that look real; if there are no posts, hide the Blog from
navigation.
```
**Verify:** With zero posts the Blog is not in the nav; adding an MDX file publishes a post and updates the RSS feed.

**Prompt H.3: Changelog (P2)**
```
Build a Product Updates page with dated entries, tags (New, Improved, Fixed), and an RSS feed.
Source: a data file maintained by the team; entries must describe shipped changes only.
```
**Verify:** Entries are in reverse date order and filterable by tag.

**Prompt H.4: Status page (P2)**
```
Build a public Status page fed by the platform health data (Super Admin Stage Q.2): current state
per component (API, web app, mobile sync, notifications), 90-day uptime bars, and an incident
history written by staff. Expose only coarse state, never internal hostnames, queue names or error
details. Add an incident create and update form to the platform panel.
```
**Verify:** Stopping a component in staging shows "degraded" on the status page within a minute without exposing internal details.

**Prompt H.5: Integrations directory (P2)**
```
Build an Integrations page from the integrations the platform actually supports (accounting
providers, payment, notifications, attendance devices, per /docs/THIRD_PARTY_INTEGRATIONS.md).
Show only integrations that are live; mark planned ones "Coming soon".
```
**Verify:** An integration that is not built is not shown as live.

---

## STAGE I: Legal and Consent

Legal text is not something Cursor should author as final. These prompts build the structure; **a qualified lawyer must review and approve the wording for each country you sell in before launch.**

**Prompt I.1 (MVP)**
```
Build Terms of Service, Privacy Policy and Cookie Policy pages from content files that are clearly
marked "DRAFT, pending legal review" and are blocked from production builds unless a
LEGAL_APPROVED=true flag and a reviewed-on date are set in the content file. Each page shows its
version and effective date. Store the version number accepted at signup (Stage E.0). Build a cookie
consent banner: no analytics or marketing scripts load before consent, categories (necessary,
analytics, marketing), a persistent "cookie settings" link, and the choice stored and honoured.
```
**Verify:** A production build fails if a legal page is still marked draft. With consent declined, confirm in the network tab that no analytics requests fire.

**Prompt I.2 (P2)**
```
Build the Data Processing Agreement page (downloadable PDF stored via the FileStorage driver) and
a Subprocessors page listing the third parties that process customer data (hosting, email, SMS,
push, payment, error tracking), with a "last updated" date and an email subscription for changes.
List only providers actually in use.
```
**Verify:** The subprocessor list matches the integrations configured in the platform settings.

---

## STAGE J: SEO, Performance, Accessibility, Languages

**Prompt J.1**
```
Implement SEO: unique title and meta description per page, canonical URLs, Open Graph and Twitter
cards with generated images, sitemap.xml and robots.txt, structured data (Organization,
SoftwareApplication, FAQ where an FAQ is shown, BreadcrumbList for the Help Center), and hreflang
for each language. Mark staging as noindex. Add redirects for any renamed URLs.
```
**Verify:** Validate structured data with a validator, and confirm staging returns noindex while production does not.

**Prompt J.2**
```
Performance and accessibility pass: image optimisation and modern formats, font loading without
layout shift, no render-blocking third-party scripts, lazy loading below the fold, and a
performance budget in CI. Check against WCAG AA: contrast, keyboard use, focus order, alt text,
form labels, reduced-motion support.
```
**Verify:** Run Lighthouse and an accessibility checker on Home, Pricing, Signup and a Help article, at phone and desktop. Record the scores and fix anything under your target (set the targets before you start, for example 90 or higher).

**Prompt J.3 (languages)**
```
Read /docs/UI_GUIDELINES.md section 9 and Super Admin M.3 (Language Packs). Add Bengali alongside
English across the marketing pages: locale routing (/bn/...), language switcher that preserves the
current page, translated metadata, locale-aware number, date and currency formatting, and a
fallback to English with a visible note when a page is not yet translated. Text must be reviewed
by a native speaker, not machine output only.
```
**Verify:** Switching language on the Pricing page keeps the same plan and currency; layouts do not break with longer Bengali text.

**Prompt J.4**
```
Add analytics behind the consent banner: pageviews, signup funnel (visit, pricing view, signup
start, email verified, tenant created), demo request and contact events, and UTM attribution stored
with the signup. Use an analytics tool that can be configured without cookies where the law
allows, and make sure no personal data (email, name) is sent to the analytics provider.
```
**Verify:** Walk one full signup and confirm each funnel event appears once, and none contains personal data.

---

## STAGE K: Hardening

**Prompt K.1**
```
Security pass on the website and its public endpoints: security headers (CSP, HSTS, frame
options, referrer policy), CORS limited to the website origin, rate limits on every public POST,
input validation and output encoding, CAPTCHA fallback if the provider is down, no secrets in the
client bundle, and dependency scanning in CI. Confirm /public/* endpoints never return data from
any tenant.
```
**Verify:** Try submitting scripts and oversized payloads to every form and confirm they are rejected or neutralised; scan the client bundle for secrets.

**Prompt K.2**
```
Deployment per /docs/DEPLOYMENT.md: separate staging and production for the website, preview
builds per pull request, CDN caching with sensible revalidation for pricing, countries and
Help Center, environment variables via the secrets manager, and a rollback procedure.
```
**Verify:** A price change in the platform is visible on production after the documented cache time; a bad deploy can be rolled back in one step.

---

## STAGE L: Final QA and Launch

**Prompt L.1: content truth audit**
```
Go through every page and produce a table: claim, where it is true in the product (module or
doc), status (live, Phase 2, Phase 3). Remove or relabel any claim that is not live. Confirm there
are no fake testimonials, logos, statistics, team members or certifications anywhere, including
in alt text and metadata.
```
**Verify:** The table has no row marked unsupported.

**Prompt L.2: end-to-end journeys**
```
Run and record these journeys at phone and desktop width, in English and Bengali: (1) Home to
Pricing to Start Free Trial to verified email to first login to the Admin Panel; (2) Book a Demo
to the lead appearing in the platform Leads page; (3) a Help Center search to an article;
(4) the Log In page for a valid and an invalid company; (5) decline cookies and confirm nothing
tracks; (6) an Enterprise visitor going Pricing to Contact Sales.
```
**Verify:** All six journeys complete with no console errors and no broken links (run a link checker).

**Prompt L.3: launch checklist**
```
Produce a LAUNCH_CHECKLIST.md for the website: legal pages approved with dates, domain and TLS,
redirects from any old domain, sales inbox and email deliverability (SPF, DKIM, DMARC), analytics
and consent verified, sitemap submitted, status page live, support contact monitored, backup of
content, and an owner for each item.
```
**Verify:** Every line has an owner and a done-date before the site goes public.

---

## After this file

All 26 page types in `WEBSITE_PAGE_INDEX.md` are built and checked, and a visitor can find the product, see real pricing, start a trial and land in their own tenant. Next in your order is the **mobile app**; ask for `CURSOR_PROMPT_PLAN_MOBILE_APP.md` when ready.
