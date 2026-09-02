export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  employmentType: string;
  status: 'Active' | 'On Leave' | 'Probation' | 'Suspended' | 'Resigned';
  email: string;
  phone: string;
  avatar?: string;
  hireDate: string;
  manager: string;
  costCentre: string;
  lifecycleStage: number;
  employeeId: string;
}

export const employees: Employee[] = [
  { id: '1', name: 'Sarah Chen', designation: 'VP Engineering', department: 'Engineering', employmentType: 'Full-Time', status: 'Active', email: 'sarah.chen@acme.com', phone: '+1 415 555 0101', hireDate: '2019-03-15', manager: 'John Smith', costCentre: 'ENG-100', lifecycleStage: 6, employeeId: 'EMP-001' },
  { id: '2', name: 'Marcus Johnson', designation: 'VP Sales', department: 'Sales', employmentType: 'Full-Time', status: 'Active', email: 'marcus.j@acme.com', phone: '+1 212 555 0102', hireDate: '2018-07-01', manager: 'John Smith', costCentre: 'SAL-200', lifecycleStage: 6, employeeId: 'EMP-002' },
  { id: '3', name: 'Priya Patel', designation: 'VP Marketing', department: 'Marketing', employmentType: 'Full-Time', status: 'Active', email: 'priya.p@acme.com', phone: '+1 415 555 0103', hireDate: '2020-01-20', manager: 'John Smith', costCentre: 'MKT-300', lifecycleStage: 6, employeeId: 'EMP-003' },
  { id: '4', name: 'Mike Ross', designation: 'Eng Director', department: 'Engineering', employmentType: 'Full-Time', status: 'On Leave', email: 'mike.ross@acme.com', phone: '+1 415 555 0104', hireDate: '2021-06-10', manager: 'Sarah Chen', costCentre: 'ENG-100', lifecycleStage: 6, employeeId: 'EMP-004' },
  { id: '5', name: 'Lisa Wang', designation: 'Eng Director', department: 'Engineering', employmentType: 'Full-Time', status: 'Active', email: 'lisa.w@acme.com', phone: '+1 415 555 0105', hireDate: '2020-09-15', manager: 'Sarah Chen', costCentre: 'ENG-100', lifecycleStage: 6, employeeId: 'EMP-005' },
  { id: '6', name: 'David Kim', designation: 'Sales Director', department: 'Sales', employmentType: 'Full-Time', status: 'Active', email: 'david.k@acme.com', phone: '+1 212 555 0106', hireDate: '2021-02-01', manager: 'Marcus Johnson', costCentre: 'SAL-200', lifecycleStage: 6, employeeId: 'EMP-006' },
  { id: '7', name: 'Emma Wilson', designation: 'Sales Director', department: 'Sales', employmentType: 'Full-Time', status: 'Active', email: 'emma.w@acme.com', phone: '+1 212 555 0107', hireDate: '2022-03-20', manager: 'Marcus Johnson', costCentre: 'SAL-200', lifecycleStage: 6, employeeId: 'EMP-007' },
  { id: '8', name: 'Tom Anderson', designation: 'Marketing Lead', department: 'Marketing', employmentType: 'Full-Time', status: 'Active', email: 'tom.a@acme.com', phone: '+1 415 555 0108', hireDate: '2022-08-01', manager: 'Priya Patel', costCentre: 'MKT-300', lifecycleStage: 6, employeeId: 'EMP-008' },
  { id: '9', name: 'Nina Garcia', designation: 'QA Lead', department: 'Engineering', employmentType: 'Full-Time', status: 'Active', email: 'nina.g@acme.com', phone: '+1 415 555 0109', hireDate: '2021-11-15', manager: 'Sarah Chen', costCentre: 'ENG-100', lifecycleStage: 6, employeeId: 'EMP-009' },
  { id: '10', name: 'James Park', designation: 'Software Engineer II', department: 'Engineering', employmentType: 'Contract', status: 'Probation', email: 'james.p@acme.com', phone: '+1 415 555 0110', hireDate: '2024-08-01', manager: 'Lisa Wang', costCentre: 'ENG-100', lifecycleStage: 5, employeeId: 'EMP-010' },
  { id: '11', name: 'Sofia Martinez', designation: 'HR Coordinator', department: 'HR', employmentType: 'Full-Time', status: 'Active', email: 'sofia.m@acme.com', phone: '+1 415 555 0111', hireDate: '2023-04-10', manager: 'Alex Morgan', costCentre: 'HR-400', lifecycleStage: 6, employeeId: 'EMP-011' },
  { id: '12', name: 'Robert Lee', designation: 'Senior Software Engineer', department: 'Engineering', employmentType: 'Full-Time', status: 'Resigned', email: 'robert.l@acme.com', phone: '+1 415 555 0112', hireDate: '2019-12-01', manager: 'Mike Ross', costCentre: 'ENG-100', lifecycleStage: 6, employeeId: 'EMP-012' },
  { id: '13', name: 'Tom Hardy', designation: 'DevOps Lead', department: 'Engineering', employmentType: 'Full-Time', status: 'Suspended', email: 'tom.h@acme.com', phone: '+1 415 555 0113', hireDate: '2020-05-15', manager: 'Sarah Chen', costCentre: 'ENG-100', lifecycleStage: 6, employeeId: 'EMP-013' },
  { id: '14', name: 'Alex Morgan', designation: 'HR Director', department: 'HR', employmentType: 'Full-Time', status: 'Active', email: 'alex.m@acme.com', phone: '+1 415 555 0114', hireDate: '2017-03-01', manager: 'John Smith', costCentre: 'HR-400', lifecycleStage: 6, employeeId: 'EMP-014' },
  { id: '15', name: 'Daniel Cho', designation: 'Financial Analyst', department: 'Finance', employmentType: 'Part-Time', status: 'Active', email: 'daniel.c@acme.com', phone: '+1 415 555 0115', hireDate: '2023-09-20', manager: 'Sofia Martinez', costCentre: 'FIN-500', lifecycleStage: 6, employeeId: 'EMP-015' },
];

export const lifecycleStages = ['Applicant', 'Interview', 'Offer', 'Hired', 'Onboarding', 'Probation', 'Confirmed'];

export interface Candidate {
  id: string;
  name: string;
  role: string;
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired';
  email: string;
  experience: string;
  rating: number;
  avatarColor: string;
}

export const candidates: Candidate[] = [
  { id: 'c1', name: 'Jennifer Wu', role: 'Senior Frontend Engineer', stage: 'Applied', email: 'jwu@email.com', experience: '6 years', rating: 0, avatarColor: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300' },
  { id: 'c2', name: 'Carlos Mendez', role: 'Backend Engineer', stage: 'Applied', email: 'cmendez@email.com', experience: '4 years', rating: 0, avatarColor: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' },
  { id: 'c3', name: 'Aisha Khan', role: 'Product Designer', stage: 'Screening', email: 'akhan@email.com', experience: '5 years', rating: 4, avatarColor: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300' },
  { id: 'c4', name: 'Ryan O\'Brien', role: 'DevOps Engineer', stage: 'Screening', email: 'robrien@email.com', experience: '7 years', rating: 3, avatarColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'c5', name: 'Mei Lin', role: 'Senior Frontend Engineer', stage: 'Interview', email: 'meilin@email.com', experience: '8 years', rating: 5, avatarColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { id: 'c6', name: 'Victor Reyes', role: 'Sales Executive', stage: 'Interview', email: 'vreyes@email.com', experience: '3 years', rating: 4, avatarColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { id: 'c7', name: 'Hannah Schmidt', role: 'Marketing Manager', stage: 'Offer', email: 'hschmidt@email.com', experience: '9 years', rating: 5, avatarColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { id: 'c8', name: 'Oliver Brown', role: 'Data Analyst', stage: 'Hired', email: 'obrown@email.com', experience: '2 years', rating: 4, avatarColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
];

export interface Contract {
  id: string;
  employeeName: string;
  employeeId: string;
  type: 'Fixed-Term' | 'Permanent' | 'Casual' | 'Project';
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Draft';
  payRate: string;
  payFrequency: string;
}

export const contracts: Contract[] = [
  { id: 'ct1', employeeName: 'Sarah Chen', employeeId: 'EMP-001', type: 'Permanent', startDate: '2019-03-15', endDate: '—', status: 'Active', payRate: '$180,000/yr', payFrequency: 'Monthly' },
  { id: 'ct2', employeeName: 'James Park', employeeId: 'EMP-010', type: 'Fixed-Term', startDate: '2024-08-01', endDate: '2025-01-31', status: 'Expiring Soon', payRate: '$85/hr', payFrequency: 'Bi-weekly' },
  { id: 'ct3', employeeName: 'Marcus Johnson', employeeId: 'EMP-002', type: 'Permanent', startDate: '2018-07-01', endDate: '—', status: 'Active', payRate: '$165,000/yr', payFrequency: 'Monthly' },
  { id: 'ct4', employeeName: 'Robert Lee', employeeId: 'EMP-012', type: 'Permanent', startDate: '2019-12-01', endDate: '—', status: 'Expired', payRate: '$140,000/yr', payFrequency: 'Monthly' },
  { id: 'ct5', employeeName: 'Daniel Cho', employeeId: 'EMP-015', type: 'Casual', startDate: '2023-09-20', endDate: '2024-09-20', status: 'Expiring Soon', payRate: '$45/hr', payFrequency: 'Weekly' },
  { id: 'ct6', employeeName: 'Sofia Martinez', employeeId: 'EMP-011', type: 'Permanent', startDate: '2023-04-10', endDate: '—', status: 'Active', payRate: '$72,000/yr', payFrequency: 'Monthly' },
  { id: 'ct7', employeeName: 'Tom Hardy', employeeId: 'EMP-013', type: 'Permanent', startDate: '2020-05-15', endDate: '—', status: 'Active', payRate: '$135,000/yr', payFrequency: 'Monthly' },
];

export interface DocType {
  id: string;
  name: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'file' | 'signature';
  required: boolean;
  expiryTracking: boolean;
  description: string;
}

export const docTypes: DocType[] = [
  { id: 'dt1', name: 'National ID', fieldType: 'text', required: true, expiryTracking: false, description: 'Government-issued national identity number' },
  { id: 'dt2', name: 'Passport', fieldType: 'file', required: false, expiryTracking: true, description: 'Passport scan with expiry date' },
  { id: 'dt3', name: 'Employment Contract', fieldType: 'file', required: true, expiryTracking: true, description: 'Signed employment agreement' },
  { id: 'dt4', name: 'Salary Certificate', fieldType: 'file', required: false, expiryTracking: false, description: 'Official salary verification document' },
  { id: 'dt5', name: 'Bank Account Details', fieldType: 'text', required: true, expiryTracking: false, description: 'Bank account number and routing info' },
  { id: 'dt6', name: 'Tax Declaration', fieldType: 'file', required: true, expiryTracking: true, description: 'Annual tax filing form' },
  { id: 'dt7', name: 'Degree Certificate', fieldType: 'file', required: false, expiryTracking: false, description: 'Highest educational qualification' },
  { id: 'dt8', name: 'Emergency Contact', fieldType: 'text', required: true, expiryTracking: false, description: 'Primary emergency contact information' },
];

export interface EmpDocument {
  id: string;
  name: string;
  type: string;
  uploadedDate: string;
  expiryDate: string | null;
  status: 'Verified' | 'Pending' | 'Rejected' | 'Expiring Soon';
  size: string;
}

export const empDocuments: EmpDocument[] = [
  { id: 'ed1', name: 'Passport_Scan.pdf', type: 'Passport', uploadedDate: '2023-04-10', expiryDate: '2026-08-20', status: 'Expiring Soon', size: '2.4 MB' },
  { id: 'ed2', name: 'Employment_Contract.pdf', type: 'Employment Contract', uploadedDate: '2023-04-10', expiryDate: null, status: 'Verified', size: '1.1 MB' },
  { id: 'ed3', name: 'Tax_Form_2024.pdf', type: 'Tax Declaration', uploadedDate: '2024-01-15', expiryDate: '2025-12-31', status: 'Verified', size: '890 KB' },
  { id: 'ed4', name: 'Degree_Cert.pdf', type: 'Degree Certificate', uploadedDate: '2023-04-12', expiryDate: null, status: 'Verified', size: '1.8 MB' },
  { id: 'ed5', name: 'Bank_Details.pdf', type: 'Bank Account Details', uploadedDate: '2023-04-10', expiryDate: null, status: 'Pending', size: '320 KB' },
  { id: 'ed6', name: 'Salary_Cert.pdf', type: 'Salary Certificate', uploadedDate: '2024-06-01', expiryDate: null, status: 'Verified', size: '450 KB' },
];
