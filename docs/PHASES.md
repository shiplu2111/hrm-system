# PHASES.md

Recommended build order. Confirm final phasing with the product owner before locking sprints — this is a starting recommendation, not a fixed contract.

## Phase 1 — MVP (build first)

Core modules required for the first commercial release. The database schema, multi-tenant architecture, country-rule engine, and payroll calculation engine (see ARCHITECTURE.md and PAYROLL_LOGIC.md) must be finalized before UI work starts on any of these.

- **01. SaaS Platform & Multi-Tenancy**
- **02. Global Country & Compliance Framework**
- **03. Company / Organization Setup**
- **04. Employee Core (HRIS)**
- **05. Employee Lifecycle Events**
- **09. Document Management (Generalized)**
- **10. Attendance**
- **12. Roster / Shift Management**
- **13. Leave Management**
- **14. Holiday Calendar**
- **15. Overtime Management**
- **16. Payroll Setup & Salary Structure**
- **18. Payroll Processing**
- **19. Payslip & Salary Payment**
- **20. Tax Management**
- **24. Employee Self-Service (ESS)**
- **32. Mobile App**
- **33. Attendance Security (Geofence / Device / Biometric)**
- **34. Notification Engine**
- **37. Data Import / Export & Migration**
- **38. Reports**
- **39. Dashboard**
- **40. RBAC / Roles / Permissions**
- **41. Security & Compliance**
- **42. Audit Log**
- **44. Subscription & Billing**
- **47. System Settings & Backup**

## Phase 2 (build after MVP is stable and validated in production)

Important modules that extend the platform. Do not begin these until Phase 1 payroll has been validated against at least two different country configurations.

- **06. Contract Management**
- **07. Recruitment / ATS**
- **08. Onboarding / Offboarding**
- **11. Timesheet**
- **17. Payroll Rules / Formula Engine**
- **21. Superannuation / Pension / Benefits**
- **22. Loan & Salary Advance**
- **23. Expense & Reimbursement**
- **27. Asset Management**
- **35. Approval Workflow Engine / Workflow Builder**
- **36. Accounting / GL Integration**
- **43. Integration / API**
- **45. In-App Support / Help Center**
- **46. Multi-Currency, Multi-Timezone, Multi-Language**

## Phase 3 (enterprise / later maturity)

Nice-to-have modules that broaden the platform but are not required for early commercial viability.

- **25. Performance Management**
- **26. Training & Certification**
- **28. Employee Relations / Case Management**
- **29. Employee Engagement**
- **30. Health & Safety**
- **31. Vendor / Contractor Management**

## Build Order Within Phase 1

1. Database schema / ERD (tenants, countries, country_rules, departments, designations, roles, permissions, employees, salary_components, payroll_rules, attendance, roster, leave, payroll)
2. Multi-tenant + country-rule architecture (no UI yet)
3. Payroll calculation engine core, validated against 2+ countries
4. Remaining Phase 1 modules (Employee Core, Attendance, Leave, Roster, Payroll Processing, ESS, Mobile App, RBAC, Security, Audit Log)
5. Phase 2, then Phase 3
