import React, { createContext, useContext } from 'react';
import type { PlatformUserView } from '@hrm/shared-types';

export interface PlatformAuthContextValue {
  user: PlatformUserView | null;
  setUser: (user: PlatformUserView | null) => void;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | undefined>(undefined);

export function PlatformAuthProvider({
  user,
  setUser,
  logout,
  children,
}: {
  user: PlatformUserView | null;
  setUser: (user: PlatformUserView | null) => void;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <PlatformAuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return ctx;
}
