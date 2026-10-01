import { Landmark } from 'lucide-react';
import type { CostCentreRecord } from '@hrm/shared-types';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  SimpleOrgEntityScreen,
  type SimpleOrgEntityConfig,
} from '@/components/org/SimpleOrgEntityScreen';
import {
  createCostCentre,
  deleteCostCentre,
  listCostCentres,
  updateCostCentre,
} from '@/lib/organization-api';

const COST_CENTRES_CONFIG: SimpleOrgEntityConfig<CostCentreRecord> = {
  title: 'Cost Centres',
  description: 'Financial allocation units used for payroll costing and reporting.',
  noun: 'cost centre',
  icon: Landmark,
  emptyDescription: 'Cost centres let payroll costs be split and reported by business unit or location.',
  namePlaceholder: 'e.g. Head Office',
  withCode: true,
  codePlaceholder: 'CC-100',
  usageField: 'costCentreId',
  list: listCostCentres,
  create: (companyId, input) => createCostCentre(companyId, { name: input.name, code: input.code ?? '' }),
  update: (companyId, id, input) => updateCostCentre(companyId, id, input),
  remove: deleteCostCentre,
};

export function CostCentresPage() {
  return (
    <OrgPageState>
      {(companyId) => <SimpleOrgEntityScreen companyId={companyId} config={COST_CENTRES_CONFIG} />}
    </OrgPageState>
  );
}
