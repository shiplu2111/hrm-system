import type { NotificationEmitInput } from '@hrm/shared-types';

export function formatNotificationClockTime(date: Date): string {
  return date.toISOString().slice(11, 16);
}

export function buildLeaveNotificationVariables(input: {
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    leave_type: input.leaveTypeName,
    start_date: input.startDate,
    end_date: input.endDate,
  };
}

export function buildPayrollFinalizedVariables(input: {
  employeeName: string;
  periodName: string;
  netPay: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    period_name: input.periodName,
    net_pay: input.netPay,
  };
}

export function buildAttendanceLateVariables(input: {
  employeeName: string;
  workDate: string;
  clockInTime: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    work_date: input.workDate,
    clock_in_time: input.clockInTime,
  };
}

export function buildContractExpiringVariables(input: {
  employeeName: string;
  expiryDate: string;
  daysUntil: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    expiry_date: input.expiryDate,
    days_until: input.daysUntil,
  };
}

export function buildApprovalPendingVariables(input: {
  employeeName: string;
  entityLabel: string;
  stepName: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    entity_label: input.entityLabel,
    step_name: input.stepName,
  };
}

export function buildContractRenewalVariables(input: {
  employeeName: string;
  startDate: string;
  endDate: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    start_date: input.startDate,
    end_date: input.endDate,
  };
}
