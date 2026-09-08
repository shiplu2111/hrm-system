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

export function buildCertificationExpiringVariables(input: {
  employeeName: string;
  certificationName: string;
  expiryDate: string;
  daysUntil: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    certification_name: input.certificationName,
    expiry_date: input.expiryDate,
    days_until: input.daysUntil,
  };
}

export function buildKudosReceivedVariables(input: {
  fromEmployeeName: string;
  toEmployeeName: string;
  kudosMessage: string;
  kudosType: string;
}): NotificationEmitInput['variables'] {
  return {
    from_employee_name: input.fromEmployeeName,
    to_employee_name: input.toEmployeeName,
    kudos_message: input.kudosMessage,
    kudos_type: input.kudosType,
  };
}

export function buildSafetyIncidentReportedVariables(input: {
  incidentNumber: string;
  incidentType: string;
  severity: string;
  location: string;
  reporterName: string;
  regulatorReportRequired: boolean;
}): NotificationEmitInput['variables'] {
  return {
    incident_number: input.incidentNumber,
    incident_type: input.incidentType.replace(/_/g, ' '),
    severity: input.severity,
    location: input.location,
    reporter_name: input.reporterName,
    regulator_notice: input.regulatorReportRequired
      ? ' Regulator reporting may be required under country rules.'
      : '',
  };
}

export function buildExpenseOutcomeVariables(input: {
  employeeName: string;
  claimReference: string;
  amount: string;
  currency: string;
  categoryName: string;
}): NotificationEmitInput['variables'] {
  return {
    employee_name: input.employeeName,
    claim_id: input.claimReference,
    amount: `${input.currency} ${input.amount}`,
    category_name: input.categoryName,
  };
}
