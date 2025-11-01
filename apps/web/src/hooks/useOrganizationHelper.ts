import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationHelper } from '@/lib/organization-helpers';

export function useOrganizationHelper() {
  const { organization } = useOrganization();

  return useMemo(
    () => new OrganizationHelper(organization),
    [organization]
  );
}