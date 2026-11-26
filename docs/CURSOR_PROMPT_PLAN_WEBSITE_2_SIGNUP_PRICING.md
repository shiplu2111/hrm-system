# CURSOR_PROMPT_PLAN_WEBSITE_2_SIGNUP_PRICING.md

Public website, part 2 of 3: **pricing, self-service signup and trial, lead capture, and login routing.** This is where the website touches the real platform, so most stages start with a backend prompt. Finish part 1 first, and make sure Super Admin Stage C (tenant provisioning) and Stage E (plans) exist, because these prompts call them.

---

## STAGE D: Pricing

**Prompt D.0 (backend)**
```
Read /docs/BILLING_SUBSCRIPTION.md and the plans model from Super Admin Stage E.0. Build a public,
unauthenticated, rate-limited, cacheable endpoint GET /public/plans that returns only plans marked
public, with: name, description, feature list in customer-friendly labels, limits, and prices per
currency and billing cycle. It must never expose hidden plans, internal notes, cost data or
tenant information. Add a /public/currencies endpoint and pick the visitor's default currency from
their country with a manual switcher.
```
**Verify:** A hidden plan does not appear; changing a price in the platform appears on the endpoint after the cache window; the endpoint is rate limited.

**Prompt D.1**
```
Build the Pricing page from /public/plans: plan cards, monthly and yearly toggle (only if yearly
prices exist), currency switcher, "per employee per month" or base-plus-employee wording exactly as
the plan's pricing model says, a calculator (enter employee count, see estimated monthly price
using the real pricing rule, clearly marked as an estimate), a Compare Plans feature matrix, an FAQ
(billing, trial, cancelling, data export, employee limits), and CTAs (Start free trial, Contact
sales for Enterprise). If a plan has no published price, show "Contact us", never a made-up number.
```
**Verify:** The calculator's result matches what the billing job from Super Admin Stage F.0 would charge for the same employee count, for each pricing model. Toggle currency and cycle and confirm values change correctly.

---

## STAGE E: Signup and Trial

**Prompt E.0 (backend)**
```
Read /docs/AUTH_FLOW.md, /docs/SECURITY.md and Super Admin Stage C.0 (provisioning). Build public
self-service signup:
- POST /public/signup: company name, country, work email, owner name, password or magic link,
  desired subdomain, accepted terms (store the terms version and timestamp).
- Anti-abuse: CAPTCHA, per-IP and per-email rate limits, disposable email blocking, and a
  uniqueness check on subdomain and on company-plus-owner email.
- Email verification required before the tenant is provisioned. Unverified signups expire after 24
  hours and are cleaned up.
- After verification, call the provisioning job (trial plan, trial length from platform settings,
  first company, defaults for that country, owner user). Return a login URL for the new tenant.
- A signup never reveals whether an email is already registered (same response either way,
  different email content).
- Write platform audit entries and keep UTM and referrer fields for marketing attribution, with
  consent where required.
```
**Verify:** Sign up with a test email, confirm no tenant exists before verification and one exists after. Repeat signup with the same email and confirm the response is identical. Exceed the rate limit and confirm it blocks.

**Prompt E.1**
```
Build the Start Free Trial page: a short, single-column form (company, country, name, work email,
password, subdomain with live availability check, terms checkbox linking the Terms and Privacy
pages). Show what the trial includes (read from the trial plan, not typed), inline validation per
/docs/UI_GUIDELINES.md section 4, a clear error for rate limiting, and an accessible CAPTCHA.
Do not ask for a payment card during the trial unless the platform setting requires it.
```
**Verify:** The form works at phone width; errors are readable; the subdomain check responds as you type and rejects reserved words (admin, platform, www, api).

**Prompt E.2**
```
Build the Email Verification page and the Setup Progress page: after the visitor clicks the
verification link, show a progress screen while provisioning runs (poll the job status), then
redirect to the new tenant's login or straight into a first-run onboarding in the Admin Panel. If
provisioning fails, show a friendly message, keep the signup, and alert platform staff.
```
**Verify:** Simulate a provisioning failure and confirm the visitor sees a recoverable message while a platform alert is raised.

---

## STAGE F: Leads, Demos, Contact

**Prompt F.0 (backend)**
```
Build lead capture: tables for leads, demo_requests and contact_messages with fields for name,
work email, company, country, employee count band, message, source page, UTM fields, consent flags,
status (new, contacted, qualified, closed), assignee and notes. Public POST endpoints with CAPTCHA,
rate limits and honeypot field. Send a confirmation email to the visitor and a notification to the
sales inbox (address configurable in platform settings, not hard-coded). Store only the personal
data needed, honour consent, and support deletion on request per /docs/SECURITY.md section 9 and 10.
```
**Verify:** A submission creates one record, sends both emails, and a bot filling the honeypot is silently discarded.

**Prompt F.1**
```
Build the Book a Demo page: form (name, work email, company, country, employee count, what they
want to see), then a thank-you page. If a scheduling provider is later chosen, leave a single
integration point; for now confirm "we will contact you within one business day" only if that is
a promise the team can keep, otherwise use neutral wording.
```
**Verify:** The submission appears in the leads table with the source page and UTM values.

**Prompt F.2**
```
Build Contact Sales and Contact Us: a topic selector (sales, support for existing customers,
partnership, other), a form per topic, and a clear message sending existing customers to the Help
Center or in-app support instead of the sales form.
```
**Verify:** Choosing "support" shows the existing-customer guidance and does not create a sales lead.

**Prompt F.3 (Super Admin side)**
```
In apps/platform add two pages, Leads and Demo Requests: list with filters (status, country, date,
source), detail with notes and activity, assign to staff, change status, export CSV. Role-gate to
Platform Owner, Platform Admin and a Sales role (add the Sales role to platform roles). Audit log
status changes. Add these as pages 53 and 54 in SUPER_ADMIN_PAGE_INDEX.md.
```
**Verify:** A website demo request appears here within seconds; a Support Agent role cannot open the page.

---

## STAGE G: Login Routing

**Prompt G.1**
```
Read /docs/AUTH_FLOW.md section 5. Build the Log In page for the public site: the visitor enters
their company subdomain or work email and is redirected to the correct tenant login (or the
employee app). Never reveal whether an email or company exists beyond what is needed to redirect;
an unknown company shows a neutral "check the address or contact your administrator" message. Add
a "Forgot company address" flow that emails the login links for any tenants associated with that
address.
```
**Verify:** Enter a valid and an invalid company name and confirm the messages do not allow enumerating customers; the forgot flow sends an email only to the address owner.

---

## After this file

Pages 7-13 of `WEBSITE_PAGE_INDEX.md` should be done, and the full path works end to end: visitor, pricing, signup, verification, new tenant, first login. Continue with `CURSOR_PROMPT_PLAN_WEBSITE_3_CONTENT_LAUNCH.md`.
