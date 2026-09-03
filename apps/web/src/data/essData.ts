export interface ESSNotification {
  id: string;
  title: string;
  category: 'Company' | 'HR' | 'Payroll' | 'System';
  time: string;
  read: boolean;
  content: string;
}

export interface DayAttendance {
  day: number;
  date: string;
  dayName: string;
  status: 'Present' | 'Late' | 'Absent' | 'Leave' | 'Holiday' | 'Weekend';
  clockIn?: string;
  clockOut?: string;
  totalHours?: string;
  notes?: string;
}

export interface TimesheetDayRow {
  id: string;
  project: string;
  task: string;
  billable: boolean;
  hours: { [key: string]: number }; // mon: 8, tue: 7.5, etc.
}

export interface ESSLeaveRequest {
  id: string;
  leaveType: 'Annual Leave' | 'Sick Leave' | 'Personal Leave' | 'Compensatory Off';
  startDate: string;
  endDate: string;
  days: number;
  isHalfDay: boolean;
  reason: string;
  attachmentName?: string;
  status: 'Submitted' | 'Manager Review' | 'HR Review' | 'Approved' | 'Rejected';
  appliedOn: string;
  managerNotes?: string;
}

export interface ShiftSwapItem {
  id: string;
  requestedWith: string;
  myShiftDate: string;
  colleagueShiftDate: string;
  reason: string;
  status: 'Pending Colleague' | 'Pending Manager' | 'Approved' | 'Rejected';
}

export interface ESSDocument {
  id: string;
  name: string;
  type: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  expiryDate?: string;
  status: 'Verified' | 'Expiring Soon' | 'Expired' | 'Pending Verification';
}

export interface ProfileChangeRequest {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  requestedAt: string;
  status: 'Pending HR Approval' | 'Approved' | 'Rejected';
}

export const essEmployeeProfile = {
  id: 'EMP-001',
  name: 'Sarah Chen',
  preferredName: 'Sarah',
  designation: 'VP of Engineering',
  department: 'Engineering',
  email: 'sarah.chen@acme.com',
  phone: '+1 (415) 555-0192',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  joiningDate: '2019-03-15',
  manager: 'John Smith (CEO)',
  workLocation: 'San Francisco HQ (100 Market St)',
  employmentType: 'Full-Time Permanent',
  costCentre: 'ENG-100',
  shift: 'Standard Morning Shift (08:00 - 17:00)',
  completionPercentage: 85,
  personalInfo: {
    dob: '1990-06-24',
    gender: 'Female',
    maritalStatus: 'Married',
    nationality: 'United States',
    bloodGroup: 'O+',
  },
  contactInfo: {
    address: '450 Mission Street, Apt 18B, San Francisco, CA 94105',
    personalEmail: 'sarah.chen.personal@gmail.com',
    emergencyContactName: 'David Chen',
    emergencyRelationship: 'Spouse',
    emergencyPhone: '+1 (415) 555-0144',
  },
  bankInfo: {
    bankName: 'Silicon Valley Bank / First Citizens',
    accountNumber: '••••••••4892',
    routingNumber: '021000021',
    accountType: 'Checking',
    taxRegime: 'US Standard W-4',
    ssnOrTaxId: 'XXX-XX-9481',
  },
  dependents: [
    { name: 'David Chen', relationship: 'Spouse', dob: '1988-11-12', benefitCoverage: 'Full Medical & Dental (Gold)' },
    { name: 'Maya Chen', relationship: 'Daughter', dob: '2021-04-03', benefitCoverage: 'Full Medical (Gold)' },
  ],
};

export const essLeaveBalances = [
  { type: 'Annual Leave', total: 25, used: 7, pending: 2, available: 16, color: 'bg-accent-500', tone: 'accent' },
  { type: 'Sick Leave', total: 12, used: 2, pending: 0, available: 10, color: 'bg-rose-500', tone: 'error' },
  { type: 'Personal Leave', total: 5, used: 1, pending: 0, available: 4, color: 'bg-warning-500', tone: 'warning' },
  { type: 'Maternity / Paternity', total: 84, used: 0, pending: 0, available: 84, color: 'bg-purple-500', tone: 'purple' },
];

export const essMonthlyHeatmap: DayAttendance[] = [
  { day: 1, date: '2024-08-01', dayName: 'Thu', status: 'Present', clockIn: '08:55', clockOut: '17:15', totalHours: '8h 20m' },
  { day: 2, date: '2024-08-02', dayName: 'Fri', status: 'Present', clockIn: '08:50', clockOut: '17:30', totalHours: '8h 40m' },
  { day: 3, date: '2024-08-03', dayName: 'Sat', status: 'Weekend' },
  { day: 4, date: '2024-08-04', dayName: 'Sun', status: 'Weekend' },
  { day: 5, date: '2024-08-05', dayName: 'Mon', status: 'Present', clockIn: '08:45', clockOut: '17:10', totalHours: '8h 25m' },
  { day: 6, date: '2024-08-06', dayName: 'Tue', status: 'Late', clockIn: '09:22', clockOut: '18:00', totalHours: '8h 38m', notes: 'Traffic delay on Bay Bridge' },
  { day: 7, date: '2024-08-07', dayName: 'Wed', status: 'Present', clockIn: '08:58', clockOut: '17:05', totalHours: '8h 07m' },
  { day: 8, date: '2024-08-08', dayName: 'Thu', status: 'Present', clockIn: '08:52', clockOut: '17:20', totalHours: '8h 28m' },
  { day: 9, date: '2024-08-09', dayName: 'Fri', status: 'Present', clockIn: '08:48', clockOut: '17:00', totalHours: '8h 12m' },
  { day: 10, date: '2024-08-10', dayName: 'Sat', status: 'Weekend' },
  { day: 11, date: '2024-08-11', dayName: 'Sun', status: 'Weekend' },
  { day: 12, date: '2024-08-12', dayName: 'Mon', status: 'Leave', notes: 'Approved Sick Leave' },
  { day: 13, date: '2024-08-13', dayName: 'Tue', status: 'Present', clockIn: '08:50', clockOut: '17:15', totalHours: '8h 25m' },
  { day: 14, date: '2024-08-14', dayName: 'Wed', status: 'Present', clockIn: '08:45', clockOut: '17:40', totalHours: '8h 55m' },
  { day: 15, date: '2024-08-15', dayName: 'Thu', status: 'Holiday', notes: 'Company Foundation Day' },
  { day: 16, date: '2024-08-16', dayName: 'Fri', status: 'Present', clockIn: '08:55', clockOut: '17:10', totalHours: '8h 15m' },
  { day: 17, date: '2024-08-17', dayName: 'Sat', status: 'Weekend' },
  { day: 18, date: '2024-08-18', dayName: 'Sun', status: 'Weekend' },
  { day: 19, date: '2024-08-19', dayName: 'Mon', status: 'Present', clockIn: '08:50', clockOut: '17:25', totalHours: '8h 35m' },
  { day: 20, date: '2024-08-20', dayName: 'Tue', status: 'Present', clockIn: '08:52', clockOut: '17:15', totalHours: '8h 23m' },
  { day: 21, date: '2024-08-21', dayName: 'Wed', status: 'Present', clockIn: '08:40', clockOut: '18:10', totalHours: '9h 30m' },
  { day: 22, date: '2024-08-22', dayName: 'Thu', status: 'Present', clockIn: '08:50', clockOut: '17:20', totalHours: '8h 30m' },
  { day: 23, date: '2024-08-23', dayName: 'Fri', status: 'Present', clockIn: '08:48', clockOut: '17:15', totalHours: '8h 27m' },
  { day: 24, date: '2024-08-24', dayName: 'Sat', status: 'Weekend' },
  { day: 25, date: '2024-08-25', dayName: 'Sun', status: 'Weekend' },
  { day: 26, date: '2024-08-26', dayName: 'Mon', status: 'Present', clockIn: '08:52', clockOut: 'In Progress', totalHours: 'Working Now' },
];

export const essTimesheetEntries: TimesheetDayRow[] = [
  {
    id: 'ts-1',
    project: 'Nexus HR Platform v2.0',
    task: 'Architecture Review & ESS Refactor',
    billable: true,
    hours: { mon: 8, tue: 8, wed: 8, thu: 7.5, fri: 8, sat: 0, sun: 0 },
  },
  {
    id: 'ts-2',
    project: 'Internal Infrastructure',
    task: 'Kubernetes Cluster Security Audit',
    billable: false,
    hours: { mon: 0, tue: 1, wed: 0, thu: 1, fri: 0, sat: 0, sun: 0 },
  },
  {
    id: 'ts-3',
    project: 'Client Engagement: Globex',
    task: 'Technical Due Diligence & API Demo',
    billable: true,
    hours: { mon: 0, tue: 0, wed: 1.5, thu: 0, fri: 1, sat: 0, sun: 0 },
  },
];

export const essLeaveRequests: ESSLeaveRequest[] = [
  {
    id: 'lr-201',
    leaveType: 'Annual Leave',
    startDate: '2024-09-02',
    endDate: '2024-09-06',
    days: 5,
    isHalfDay: false,
    reason: 'Annual family vacation trip to Hawaii.',
    status: 'Manager Review',
    appliedOn: '2024-08-20',
  },
  {
    id: 'lr-202',
    leaveType: 'Sick Leave',
    startDate: '2024-08-12',
    endDate: '2024-08-12',
    days: 1,
    isHalfDay: false,
    reason: 'Dental surgery and prescribed recovery.',
    attachmentName: 'dental_clinic_receipt.pdf',
    status: 'Approved',
    appliedOn: '2024-08-11',
    managerNotes: 'Approved by John Smith on Aug 11.',
  },
  {
    id: 'lr-203',
    leaveType: 'Personal Leave',
    startDate: '2024-07-05',
    endDate: '2024-07-05',
    days: 1,
    isHalfDay: true,
    reason: 'Home utility maintenance appointment.',
    status: 'Approved',
    appliedOn: '2024-07-01',
  },
];

export const essShiftRoster = [
  { date: '2024-08-26', day: 'Monday', shift: 'Morning Shift', hours: '08:00 – 17:00', location: 'SF HQ Room 4A' },
  { date: '2024-08-27', day: 'Tuesday', shift: 'Morning Shift', hours: '08:00 – 17:00', location: 'SF HQ Room 4A' },
  { date: '2024-08-28', day: 'Wednesday', shift: 'Morning Shift', hours: '08:00 – 17:00', location: 'SF HQ Room 4A' },
  { date: '2024-08-29', day: 'Thursday', shift: 'Morning Shift', hours: '08:00 – 17:00', location: 'SF HQ Room 4A' },
  { date: '2024-08-30', day: 'Friday', shift: 'Remote Shift', hours: '09:00 – 18:00', location: 'Home Office' },
  { date: '2024-08-31', day: 'Saturday', shift: 'Off Day', hours: '—', location: '—' },
  { date: '2024-09-01', day: 'Sunday', shift: 'Off Day', hours: '—', location: '—' },
];

export const essDocuments: ESSDocument[] = [
  {
    id: 'doc-1',
    name: 'US Passport & Visa',
    type: 'Identity / Travel',
    fileName: 'passport_sarah_chen_2028.pdf',
    fileSize: '2.4 MB',
    uploadDate: '2023-04-10',
    expiryDate: '2028-06-15',
    status: 'Verified',
  },
  {
    id: 'doc-2',
    name: 'Executive Employment Contract',
    type: 'Legal / Contract',
    fileName: 'employment_agreement_signed.pdf',
    fileSize: '1.8 MB',
    uploadDate: '2019-03-15',
    status: 'Verified',
  },
  {
    id: 'doc-3',
    name: 'Driver License',
    type: 'State ID',
    fileName: 'ca_driver_license_2024.pdf',
    fileSize: '950 KB',
    uploadDate: '2022-09-01',
    expiryDate: '2024-09-15',
    status: 'Expiring Soon',
  },
  {
    id: 'doc-4',
    name: 'Master of Science Degree Certificate',
    type: 'Education',
    fileName: 'stanford_ms_cs_degree.pdf',
    fileSize: '3.1 MB',
    uploadDate: '2019-03-15',
    status: 'Verified',
  },
];

export const essAnnouncements: ESSNotification[] = [
  {
    id: 'ann-1',
    title: 'Company Foundation Day Celebrations on Aug 15th',
    category: 'Company',
    time: '2 days ago',
    read: false,
    content: 'Join us at the SF HQ rooftop terrace for the annual celebration lunch and awards ceremony.',
  },
  {
    id: 'ann-2',
    title: 'Open Enrollment for 2025 Health Benefits is Now Active',
    category: 'HR',
    time: '1 week ago',
    read: true,
    content: 'Review and update your medical, dental, and 401(k) allocations before September 15.',
  },
  {
    id: 'ann-3',
    title: 'New Biometric Turnstile Access Live in West Wing',
    category: 'System',
    time: '2 weeks ago',
    read: true,
    content: 'Facial and mobile tap entry is now available at all 4th floor entry gates.',
  },
];

