---
slug: "dpa"
title: "Data Processing Agreement (DPA)"
version: "2026-11"
effectiveDate: "2026-11-25"
LEGAL_APPROVED: false
reviewedOn: ""
draftNotice: "DRAFT, pending legal review"
summary: "Standard customer Data Processing Agreement governing multi-tenant workforce processing, security safeguards, and authorized subprocessors."
---

> **DRAFT, pending legal review** — This Data Processing Agreement template is provided for pre-launch verification and must be reviewed and approved by qualified counsel before production launch.

## 1. Roles of the Parties

- **Customer (Data Controller)**: Determines the purposes and means of processing employee, attendance, leave, and payroll personal data within its isolated CMSN-HR tenant workspace.
- **CMSN-HR (Data Processor)**: Processes Customer Data strictly on documented Customer instructions to deliver contracted HR, attendance, and payroll services.

## 2. Subject Matter & Categories of Data

- **Data Subjects**: Employees, contractors, job applicants, managers, and organization administrators.
- **Personal Data Categories**: Work identity details, employment records, attendance clock-ins, geolocation checks, leave requests, pay components, tax withholdings, and bank transfer metadata.

## 3. Technical & Organizational Security Measures (Annex II)

- **Strict Tenant Isolation**: Every business record carries a server-verified `tenant_id` scoped exclusively from authenticated sessions.
- **Encryption**: TLS in transit, bcrypt credential hashing, and AES field-level encryption for sensitive tokens, keys, and identifiers.
- **Auditability & Financial Locks**: Immutable payroll finalization locks (`payroll_adjustments` for corrections) and platform/tenant audit logging (`audit_logs`).
- **Retention & Erasure**: Supports verified data-subject deletion and scheduled backup retention policies.

## 4. Subprocessors (Annex III)

CMSN-HR authorizes only those third-party subprocessors actively configured in the platform for hosting, transactional email, SMS, push notifications, billing payments, and optional error tracking. The live provider list is published on the **Subprocessors** page with advance change subscription.
