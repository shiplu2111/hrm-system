import { BadgeCheck } from 'lucide-react';
import type { NamedOrgEntity } from '@hrm/shared-types';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  SimpleOrgEntityScreen,
  type SimpleOrgEntityConfig,
} from '@/components/org/SimpleOrgEntityScreen';
import {
  createEmploymentType,
  deleteEmploymentType,
  listEmploymentTypes,
  updateEmploymentType,
} from '@/lib/organization-api';

const EMPLOYMENT_TYPES_CONFIG: SimpleOrgEntityConfig<NamedOrgEntity> = {
  title: 'Employment Types',
  description: 'How employees are classified, e.g. full time, contractor or intern.',
  noun: 'employment type',
  icon: BadgeCheck,
  emptyDescription: 'Employment types are required when adding employees and creating offer letters.',
  namePlaceholder: 'e.g. Full Time',
  usageField: 'employmentTypeId',
  suggestions: ['Full Time', 'Part Time', 'Contractor', 'Intern', 'Casual'],
  list: listEmploymentTypes,
  create: (companyId, input) => createEmploymentType(companyId, { name: input.name }),
  update: (companyId, id, input) => updateEmploymentType(companyId, id, { name: input.name }),
  remove: deleteEmploymentType,
};

export function EmploymentTypesPage() {
  return (
    <OrgPageState>
      {(companyId) => <SimpleOrgEntityScreen companyId={companyId} config={EMPLOYMENT_TYPES_CONFIG} />}
    </OrgPageState>
  );
}
