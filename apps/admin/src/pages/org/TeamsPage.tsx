import { UsersRound } from 'lucide-react';
import type { NamedOrgEntity } from '@hrm/shared-types';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  SimpleOrgEntityScreen,
  type SimpleOrgEntityConfig,
} from '@/components/org/SimpleOrgEntityScreen';
import { createTeam, deleteTeam, listTeams, updateTeam } from '@/lib/organization-api';

const TEAMS_CONFIG: SimpleOrgEntityConfig<NamedOrgEntity> = {
  title: 'Teams',
  description: 'Cross-functional or project teams that sit alongside the department structure.',
  noun: 'team',
  icon: UsersRound,
  emptyDescription: 'Create teams for squads, projects or working groups that span departments.',
  namePlaceholder: 'e.g. Platform Squad',
  list: listTeams,
  create: (companyId, input) => createTeam(companyId, { name: input.name }),
  update: (companyId, id, input) => updateTeam(companyId, id, { name: input.name }),
  remove: deleteTeam,
};

export function TeamsPage() {
  return (
    <OrgPageState>
      {(companyId) => <SimpleOrgEntityScreen companyId={companyId} config={TEAMS_CONFIG} />}
    </OrgPageState>
  );
}
