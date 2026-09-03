import {
  DEFAULT_NOTIFICATION_RULES,
  mergeNotificationRules,
  renderNotificationTemplate,
} from './notification.constants';

describe('notification.constants', () => {
  it('renders template variables', () => {
    const rendered = renderNotificationTemplate(
      'Hello {employee_name}, your {leave_type} leave starts {start_date}.',
      {
        employee_name: 'Alex',
        leave_type: 'Annual',
        start_date: '2026-06-01',
      },
    );
    expect(rendered).toBe('Hello Alex, your Annual leave starts 2026-06-01.');
  });

  it('merges tenant rule overrides without dropping defaults', () => {
    const merged = mergeNotificationRules({
      'attendance.late': {
        enabled: false,
        channels: { inApp: true, email: false, push: true },
        recipients: ['subject_employee'],
      },
    });

    expect(merged['attendance.late'].enabled).toBe(false);
    expect(merged['attendance.late'].channels.email).toBe(false);
    expect(merged['attendance.late'].channels.push).toBe(true);
    expect(merged['leave.approved']).toEqual(DEFAULT_NOTIFICATION_RULES['leave.approved']);
  });
});
