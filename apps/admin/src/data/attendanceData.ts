export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Early Leave' | 'Half Day' | 'WFH' | 'Business Trip' | 'On Leave';

export interface AttendanceRecord {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  status: AttendanceStatus;
  clockIn: string;
  clockOut: string;
  breakTime: string;
  totalHours: string;
  overtime: string;
  location: string;
}

export const attendanceRecords: AttendanceRecord[] = [
  { id: 'a1', employeeName: 'Sarah Chen', employeeId: 'EMP-001', department: 'Engineering', status: 'Present', clockIn: '08:52', clockOut: '17:15', breakTime: '45m', totalHours: '7h 38m', overtime: '0h', location: 'SF HQ' },
  { id: 'a2', employeeName: 'Marcus Johnson', employeeId: 'EMP-002', department: 'Sales', status: 'Late', clockIn: '09:35', clockOut: '18:00', breakTime: '1h', totalHours: '7h 25m', overtime: '0h', location: 'NY Office' },
  { id: 'a3', employeeName: 'Priya Patel', employeeId: 'EMP-003', department: 'Marketing', status: 'WFH', clockIn: '09:00', clockOut: '17:30', breakTime: '1h', totalHours: '7h 30m', overtime: '0h', location: 'Remote' },
  { id: 'a4', employeeName: 'Mike Ross', employeeId: 'EMP-004', department: 'Engineering', status: 'On Leave', clockIn: '—', clockOut: '—', breakTime: '—', totalHours: '0h', overtime: '0h', location: '—' },
  { id: 'a5', employeeName: 'Lisa Wang', employeeId: 'EMP-005', department: 'Engineering', status: 'Present', clockIn: '08:45', clockOut: '18:20', breakTime: '45m', totalHours: '8h 50m', overtime: '0h 50m', location: 'SF HQ' },
  { id: 'a6', employeeName: 'David Kim', employeeId: 'EMP-006', department: 'Sales', status: 'Business Trip', clockIn: '—', clockOut: '—', breakTime: '—', totalHours: '—', overtime: '0h', location: 'Client Site' },
  { id: 'a7', employeeName: 'Emma Wilson', employeeId: 'EMP-007', department: 'Sales', status: 'Early Leave', clockIn: '09:00', clockOut: '15:30', breakTime: '45m', totalHours: '5h 45m', overtime: '0h', location: 'NY Office' },
  { id: 'a8', employeeName: 'Tom Anderson', employeeId: 'EMP-008', department: 'Marketing', status: 'Half Day', clockIn: '09:00', clockOut: '13:00', breakTime: '0m', totalHours: '4h 00m', overtime: '0h', location: 'SF HQ' },
  { id: 'a9', employeeName: 'Nina Garcia', employeeId: 'EMP-009', department: 'Engineering', status: 'Present', clockIn: '08:58', clockOut: '17:05', breakTime: '1h', totalHours: '7h 07m', overtime: '0h', location: 'SF HQ' },
  { id: 'a10', employeeName: 'James Park', employeeId: 'EMP-010', department: 'Engineering', status: 'Absent', clockIn: '—', clockOut: '—', breakTime: '—', totalHours: '0h', overtime: '0h', location: '—' },
  { id: 'a11', employeeName: 'Sofia Martinez', employeeId: 'EMP-011', department: 'HR', status: 'Present', clockIn: '08:30', clockOut: '17:10', breakTime: '45m', totalHours: '7h 55m', overtime: '0h', location: 'SF HQ' },
  { id: 'a12', employeeName: 'Daniel Cho', employeeId: 'EMP-015', department: 'Finance', status: 'Late', clockIn: '09:45', clockOut: '17:30', breakTime: '1h', totalHours: '6h 45m', overtime: '0h', location: 'SF HQ' },
];

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakTime: string;
  gracePeriod: string;
  lateRule: string;
  otRule: string;
  color: string;
}

export const shifts: Shift[] = [
  { id: 's1', name: 'Morning Shift', startTime: '08:00', endTime: '17:00', breakTime: '1 hour', gracePeriod: '15 min', lateRule: 'After 08:15', otRule: '1.5x after 8h', color: 'bg-accent-500' },
  { id: 's2', name: 'Evening Shift', startTime: '14:00', endTime: '23:00', breakTime: '1 hour', gracePeriod: '10 min', lateRule: 'After 14:10', otRule: '1.5x after 8h', color: 'bg-warning-500' },
  { id: 's3', name: 'Night Shift', startTime: '22:00', endTime: '07:00', breakTime: '1 hour', gracePeriod: '15 min', lateRule: 'After 22:15', otRule: '2x after 8h', color: 'bg-purple-500' },
  { id: 's4', name: 'Flexible Shift', startTime: 'Flexible', endTime: '8h window', breakTime: '1 hour', gracePeriod: '30 min', lateRule: 'N/A', otRule: '1.5x after 8h', color: 'bg-success-500' },
];

export type LeaveType = 'Annual' | 'Sick' | 'Personal' | 'Unpaid' | 'Maternity' | 'Paternity' | 'Compassionate' | 'Custom';

export interface LeaveTypeConfig {
  id: string;
  name: LeaveType;
  entitlement: number;
  accrualRate: string;
  carryForward: string;
  encashment: string;
  paid: boolean;
  color: string;
}

export const leaveTypes: LeaveTypeConfig[] = [
  { id: 'lt1', name: 'Annual', entitlement: 25, accrualRate: '2.08/month', carryForward: 'Up to 10 days', encashment: 'Allowed on exit', paid: true, color: 'bg-accent-500' },
  { id: 'lt2', name: 'Sick', entitlement: 12, accrualRate: '1/month', carryForward: 'No carry forward', encashment: 'Not allowed', paid: true, color: 'bg-error-500' },
  { id: 'lt3', name: 'Personal', entitlement: 5, accrualRate: '0.42/month', carryForward: 'No carry forward', encashment: 'Not allowed', paid: true, color: 'bg-warning-500' },
  { id: 'lt4', name: 'Unpaid', entitlement: 30, accrualRate: 'On demand', carryForward: 'N/A', encashment: 'N/A', paid: false, color: 'bg-slate-500' },
  { id: 'lt5', name: 'Maternity', entitlement: 84, accrualRate: 'Fixed allocation', carryForward: 'N/A', encashment: 'N/A', paid: true, color: 'bg-purple-500' },
  { id: 'lt6', name: 'Paternity', entitlement: 14, accrualRate: 'Fixed allocation', carryForward: 'N/A', encashment: 'N/A', paid: true, color: 'bg-success-500' },
  { id: 'lt7', name: 'Compassionate', entitlement: 3, accrualRate: 'On demand', carryForward: 'No carry forward', encashment: 'N/A', paid: true, color: 'bg-rose-500' },
];

export interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending Manager' | 'Pending HR' | 'Approved' | 'Rejected';
  appliedDate: string;
}

export const leaveRequests: LeaveRequest[] = [
  { id: 'lr1', employeeName: 'Sarah Chen', employeeId: 'EMP-001', leaveType: 'Annual', startDate: '2024-09-02', endDate: '2024-09-06', days: 5, reason: 'Family vacation', status: 'Pending Manager', appliedDate: '2024-08-20' },
  { id: 'lr2', employeeName: 'Marcus Johnson', employeeId: 'EMP-002', leaveType: 'Sick', startDate: '2024-08-26', endDate: '2024-08-27', days: 2, reason: 'Flu — doctor recommended rest', status: 'Pending HR', appliedDate: '2024-08-25' },
  { id: 'lr3', employeeName: 'Priya Patel', employeeId: 'EMP-003', leaveType: 'Personal', startDate: '2024-08-30', endDate: '2024-08-30', days: 1, reason: 'Personal errand', status: 'Approved', appliedDate: '2024-08-22' },
  { id: 'lr4', employeeName: 'David Kim', employeeId: 'EMP-006', leaveType: 'Annual', startDate: '2024-09-10', endDate: '2024-09-13', days: 4, reason: 'Wedding anniversary trip', status: 'Pending Manager', appliedDate: '2024-08-24' },
  { id: 'lr5', employeeName: 'Emma Wilson', employeeId: 'EMP-007', leaveType: 'Sick', startDate: '2024-08-25', endDate: '2024-08-25', days: 1, reason: 'Migraine', status: 'Rejected', appliedDate: '2024-08-24' },
];

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'Public' | 'State' | 'Company' | 'Branch';
  branches: string;
}

export const holidays: Holiday[] = [
  { id: 'h1', name: 'New Year\'s Day', date: '2024-01-01', type: 'Public', branches: 'All' },
  { id: 'h2', name: 'Memorial Day', date: '2024-05-27', type: 'Public', branches: 'All' },
  { id: 'h3', name: 'Independence Day', date: '2024-07-04', type: 'Public', branches: 'All' },
  { id: 'h4', name: 'Labor Day', date: '2024-09-02', type: 'Public', branches: 'All' },
  { id: 'h5', name: 'Thanksgiving', date: '2024-11-28', type: 'Public', branches: 'All' },
  { id: 'h6', name: 'Christmas Day', date: '2024-12-25', type: 'Public', branches: 'All' },
  { id: 'h7', name: 'Company Foundation Day', date: '2024-03-15', type: 'Company', branches: 'All' },
  { id: 'h8', name: 'Annual Retreat', date: '2024-10-18', type: 'Company', branches: 'SF HQ' },
  { id: 'h9', name: 'NY Local Holiday', date: '2024-06-19', type: 'State', branches: 'NY Office' },
];

export interface OTRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  date: string;
  hours: number;
  rateType: 'Weekday' | 'Weekend' | 'Holiday' | 'Night';
  status: 'Pending' | 'Approved' | 'Rejected';
  reason: string;
}

export const otRequests: OTRequest[] = [
  { id: 'ot1', employeeName: 'Lisa Wang', employeeId: 'EMP-005', date: '2024-08-24', hours: 2.5, rateType: 'Weekday', status: 'Approved', reason: 'Production deployment' },
  { id: 'ot2', employeeName: 'Nina Garcia', employeeId: 'EMP-009', date: '2024-08-25', hours: 3, rateType: 'Weekend', status: 'Pending', reason: 'Release testing' },
  { id: 'ot3', employeeName: 'Sarah Chen', employeeId: 'EMP-001', date: '2024-08-23', hours: 1.5, rateType: 'Night', status: 'Approved', reason: 'Incident response' },
  { id: 'ot4', employeeName: 'Tom Anderson', employeeId: 'EMP-008', date: '2024-08-24', hours: 4, rateType: 'Weekend', status: 'Pending', reason: 'Campaign launch prep' },
  { id: 'ot5', employeeName: 'Daniel Cho', employeeId: 'EMP-015', date: '2024-07-04', hours: 2, rateType: 'Holiday', status: 'Rejected', reason: 'Month-end closing' },
];

export interface RegRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  date: string;
  beforeClockIn: string;
  afterClockIn: string;
  beforeClockOut: string;
  afterClockOut: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export const regRequests: RegRequest[] = [
  { id: 'rg1', employeeName: 'Marcus Johnson', employeeId: 'EMP-002', date: '2024-08-25', beforeClockIn: '09:35', afterClockIn: '09:00', beforeClockOut: '18:00', afterClockOut: '18:00', reason: 'Forgot to clock in — was at desk by 09:00', status: 'Pending' },
  { id: 'rg2', employeeName: 'Daniel Cho', employeeId: 'EMP-015', date: '2024-08-25', beforeClockIn: '09:45', afterClockIn: '09:00', beforeClockOut: '17:30', afterClockOut: '17:30', reason: 'Traffic delay — manager approved late arrival', status: 'Pending' },
  { id: 'rg3', employeeName: 'Sofia Martinez', employeeId: 'EMP-011', date: '2024-08-22', beforeClockIn: '08:30', afterClockIn: '08:30', beforeClockOut: '16:00', afterClockOut: '17:10', reason: 'Forgot to clock out — worked until 17:10', status: 'Approved' },
  { id: 'rg4', employeeName: 'Tom Anderson', employeeId: 'EMP-008', date: '2024-08-20', beforeClockIn: '09:00', afterClockIn: '09:00', beforeClockOut: '13:00', afterClockOut: '17:00', reason: 'Half day marked incorrectly — worked full day', status: 'Rejected' },
];

export interface Device {
  id: string;
  employeeName: string;
  employeeId: string;
  deviceName: string;
  deviceType: string;
  lastUsed: string;
  location: string;
  suspicious: boolean;
  status: 'Active' | 'Revoked';
}

export const devices: Device[] = [
  { id: 'd1', employeeName: 'Sarah Chen', employeeId: 'EMP-001', deviceName: 'MacBook Pro 16"', deviceType: 'Laptop', lastUsed: '2024-08-25 08:52', location: 'SF HQ', suspicious: false, status: 'Active' },
  { id: 'd2', employeeName: 'Sarah Chen', employeeId: 'EMP-001', deviceName: 'iPhone 15 Pro', deviceType: 'Mobile', lastUsed: '2024-08-25 08:50', location: 'SF HQ', suspicious: false, status: 'Active' },
  { id: 'd3', employeeName: 'Marcus Johnson', employeeId: 'EMP-002', deviceName: 'Unknown Android Device', deviceType: 'Mobile', lastUsed: '2024-08-24 03:12', location: 'Unknown', suspicious: true, status: 'Active' },
  { id: 'd4', employeeName: 'Lisa Wang', employeeId: 'EMP-005', deviceName: 'Dell Latitude', deviceType: 'Laptop', lastUsed: '2024-08-25 08:45', location: 'SF HQ', suspicious: false, status: 'Active' },
  { id: 'd5', employeeName: 'James Park', employeeId: 'EMP-010', deviceName: 'iPad Air', deviceType: 'Tablet', lastUsed: '2024-08-20 09:00', location: 'SF HQ', suspicious: false, status: 'Revoked' },
];
