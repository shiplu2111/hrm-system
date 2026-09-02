# NOTIFICATION_LOGIC.md

## 1. Event-Driven Model

```
Event occurs → matches Rule(s) → resolved to Channel(s) → sent to Recipient(s)
```

Decoupled from the modules that trigger events — any module fires an event; the notification engine decides who gets notified, how, without that module needing channel-specific logic.

## 2. Channels

In-app (real-time via WebSocket + persisted notification-center entry), Push (Firebase FCM), Email (via SMTP — see §10), SMS, WhatsApp (future/Phase 2+).

## 3. Standard Events (non-exhaustive — extend per module)

```
leave.approved, leave.rejected
payroll.finalized, payslip.generated, salary.paid
attendance.late, attendance.absent, attendance.time_anomaly
roster.changed, shift.reminder
document.expiring, contract.expiring
employee.birthday, employee.work_anniversary
recruitment.interview_reminder
employee.probation_ending
approval.pending
```

## 4. Rule Configuration

Admins configure, per event type: which channel(s), which recipient role(s) (e.g. `leave.approved` → notify the employee via push + in-app; `approval.pending` → notify the approver via email + push), and whether the rule is on/off per tenant.

## 5. Recipient Resolution

- Direct recipient (the employee whose leave was approved).
- Role-based recipient (notify "the employee's manager" — resolved dynamically via `employees.manager_id`, not a static user list).
- Broadcast (company-wide announcement — see MODULES.md §29 Employee Engagement, Phase 3).

## 6. Delivery & Retry

- Push/SMS/Email delivery failures are retried with backoff; persistent failures are logged (not silently dropped) so support can investigate delivery provider issues.
- In-app notifications are always stored server-side regardless of push delivery success, so the employee sees them next time they open the app — critical for the offline-first mobile employees.

## 7. Offline Interaction

- Push notifications naturally queue at the OS/provider level for offline devices and deliver on reconnect.
- In-app notification list is fetched from the server; for a fully offline user it will simply not update until sync/reconnect — this is acceptable (notifications are not payroll-critical data).

## 8. Notification Preferences

- Employees can control channel preferences per event category where the company allows it (e.g. opt out of SMS, keep push) — critical/security notifications (e.g. password changed) are never fully suppressible.

## 9. Templates

- Each event/channel combination has a template (with variables like `{employee_name}`, `{amount}`) — stored per-tenant so companies can customize wording, with a sane default template shipped out of the box.

## 10. Real-Time Delivery (WebSocket)

- In-app notifications are delivered live via a WebSocket connection while the web/mobile client is active and foregrounded, in addition to being persisted server-side so they're visible on next login/reconnect regardless of real-time delivery success.
- Real-time is a UX enhancement layered on top of the persisted notification record — it is never the only place a notification exists (a dropped WebSocket connection must not mean a lost notification; see OFFLINE_SYNC.md for the same principle applied to attendance data).
- Which events broadcast in real time (vs. only appearing in the notification center silently) is a **per-company, admin-panel-configurable** setting — see SYSTEM_SETTINGS.md §2a. Not every event needs to interrupt the user with a live toast/banner.

## 11. SMTP & Provider Settings Are Admin-Panel-Managed

- Email delivery uses SMTP settings configured per company from the Admin Panel (host, port, username, password, from-address/name) — not hard-coded or `.env`-only. If a company hasn't configured their own SMTP, the platform's default provider is used as a fallback (see ENV_SETUP.md §2).
- Changing SMTP settings takes effect immediately for the next outgoing email — no redeploy or restart required.
- A "send test email" action in the admin panel must be available so an admin can verify their SMTP settings work before relying on them for real payslip/notification delivery.
- SMTP credentials are stored encrypted (see SECURITY.md §1, §11) and masked in the UI after save.
