import React, { createContext, useContext, useEffect, useState } from 'react';
import type { PlatformTenantSummary } from '@hrm/shared-types';
import { fetchPlatformTenants } from '@/lib/api-client';

interface PlatformTenantContextValue {
  tenants: PlatformTenantSummary[];
  selectedTenant: PlatformTenantSummary | null;
  setSelectedTenant: (tenant: PlatformTenantSummary | null) => void;
  selectTenantById: (tenantId: string | null) => void;
  isLoading: boolean;
  refreshTenants: () => Promise<void>;
}

const PlatformTenantContext = createContext<PlatformTenantContextValue | undefined>(undefined);

export function PlatformTenantProvider({ children }: { children: React.ReactNode }) {
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  // Default state per requirements: "Show 'No tenant selected' as the default state."
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenantSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshTenants = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPlatformTenants();
      setTenants(data);
    } catch {
      // In case network/endpoint is unavailable, keep existing
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTenants();
  }, []);

  const selectTenantById = (tenantId: string | null) => {
    if (!tenantId) {
      setSelectedTenant(null);
      return;
    }
    const found = tenants.find((t) => t.id === tenantId || t.subdomain === tenantId);
    if (found) {
      setSelectedTenant(found);
    }
  };

  return (
    <PlatformTenantContext.Provider
      value={{
        tenants,
        selectedTenant,
        setSelectedTenant,
        selectTenantById,
        isLoading,
        refreshTenants,
      }}
    >
      {children}
    </PlatformTenantContext.Provider>
  );
}

export function usePlatformTenant() {
  const context = useContext(PlatformTenantContext);
  if (!context) {
    throw new Error('usePlatformTenant must be used within a PlatformTenantProvider');
  }
  return context;
}
