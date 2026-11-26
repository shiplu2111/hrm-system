# WEBSITE_PAGE_INDEX.md

Page inventory for the **public marketing website** (what a visitor sees before they have an account). This is a tracking checklist, not a prompt file.

**Prompt files (build in this order):**
1. `CURSOR_PROMPT_PLAN_WEBSITE_1_FOUNDATION.md` → Stages A–C (app setup, design, core marketing pages)
2. `CURSOR_PROMPT_PLAN_WEBSITE_2_SIGNUP_PRICING.md` → Stages D–G (pricing, signup and trial, leads, login redirect)
3. `CURSOR_PROMPT_PLAN_WEBSITE_3_CONTENT_LAUNCH.md` → Stages H–L (help center, blog, legal, SEO, languages, QA, launch)

| # | Page | Priority | Covered In |
|---|---|---|---|
| 1 | Home | MVP | Stage B.1 |
| 2 | Features overview | MVP | Stage B.2 |
| 3 | Feature detail pages (Payroll, Attendance and Roster, Leave, Recruitment and Onboarding, Mobile App, Reports) | MVP | Stage B.2 |
| 4 | Solutions by country (Bangladesh, Australia, and each active country) | MVP | Stage C.1 |
| 5 | Solutions by company size or industry | P2 | Stage C.2 |
| 6 | How it works / Security and trust | MVP | Stage C.3 |
| 7 | Pricing (live from plans) | MVP | Stage D.1 |
| 8 | Compare plans | MVP | Stage D.1 |
| 9 | Start Free Trial / Signup | MVP | Stage E.1 |
| 10 | Email verification and Setup progress | MVP | Stage E.2 |
| 11 | Login redirect (find my company) | MVP | Stage G.1 |
| 12 | Book a Demo | MVP | Stage F.1 |
| 13 | Contact Sales / Contact Us | MVP | Stage F.2 |
| 14 | About | MVP | Stage C.4 |
| 15 | Careers | P2 | Stage C.4 |
| 16 | Customers and case studies | P2 | Stage C.5 |
| 17 | Help Center (public knowledge base) | MVP | Stage H.1 |
| 18 | Blog (list and article) | P2 | Stage H.2 |
| 19 | Product updates / Changelog | P2 | Stage H.3 |
| 20 | Status page | P2 | Stage H.4 |
| 21 | Integrations directory | P2 | Stage H.5 |
| 22 | Terms of Service | MVP | Stage I.1 |
| 23 | Privacy Policy | MVP | Stage I.1 |
| 24 | Cookie Policy and consent banner | MVP | Stage I.1 |
| 25 | Data Processing Agreement and Subprocessors | P2 | Stage I.2 |
| 26 | 404 and error pages | MVP | Stage A.3 |

**Total: 26 page types** (17 MVP, 9 P2). The feature detail and country pages are templates, so the real page count is higher.

## Backend and admin gaps this website exposes

The earlier plans have no backend for: public signup, lead capture, demo bookings, or a public pricing endpoint. Stage D.0, E.0 and F.0 build them. Two additions are needed on the Super Admin side too:
- **Leads and Demo Requests** page (list, assign, status, notes, export), added in Stage F.3 of this plan. Add it to `SUPER_ADMIN_PAGE_INDEX.md` as pages 53 and 54.
- The website must read plans, countries and knowledge-base articles from the platform APIs built in Super Admin parts 2, 3 and 4 (Stage E, I, R.2). Do not copy prices or country lists into the website code.
