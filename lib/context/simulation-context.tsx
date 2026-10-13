"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import type { User } from '@/lib/services/api';

export type SimulationRole = 'USER' | 'BARMAN' | 'SECURITY' | 'PAYMENT_POINT' | 'user' | 'barman' | 'security' | 'payment_point';

interface SimulationContextType {
  isSimulating: boolean;
  simulatedRole: string | null;
  simulatedUser: User | null;
  startSimulation: (targetRole: SimulationRole | string) => Promise<void>;
  stopSimulation: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextType>({
  isSimulating: false,
  simulatedRole: null,
  simulatedUser: null,
  startSimulation: async () => {},
  stopSimulation: async () => {},
});

const ROLE_ROUTES: Record<string, string> = {
  user: '/dashboard',
  barman: '/scanner/barman',
  security: '/scanner/security',
  payment_point: '/payment-point/dashboard',
  admin: '/admin',
};

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);

  // Read current simulation state from cookie on mount
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const match = document.cookie.match(/(?:^|; )passi_impersonate_role=([^;]*)/);
    if (match && match[1]) {
      const role = match[1].toLowerCase();
      setIsSimulating(true);
      setSimulatedRole(role);
    } else {
      setIsSimulating(false);
      setSimulatedRole(null);
    }
  }, []);

  /**
   * Start simulating an account role.
   * STRICT AUTHORIZATION: Enforces role-based check (no hardcoded emails or IDs).
   * Throws an error if the authenticated user is not an admin.
   */
  const startSimulation = useCallback(async (targetRole: SimulationRole | string) => {
    if (!user) {
      throw new Error("Unauthorized: No active session found.");
    }

    // Role-based check: Must be ADMIN (check both original_role and current role, case-insensitively)
    const currentActualRole = (user.original_role || user.role || '').toUpperCase();
    if (currentActualRole !== 'ADMIN') {
      throw new Error("Unauthorized: Only admins can simulate accounts.");
    }

    const normalizedRole = targetRole.toLowerCase();
    if (!['user', 'barman', 'security', 'payment_point', 'admin'].includes(normalizedRole)) {
      throw new Error(`Invalid simulation role: ${targetRole}`);
    }

    // Set cookie for middleware and SSR synchronization (expires in 24 hours)
    document.cookie = `passi_impersonate_role=${normalizedRole}; path=/; max-age=86400; SameSite=Lax`;

    setIsSimulating(true);
    setSimulatedRole(normalizedRole);

    // Refresh memory auth context so hooks and UI immediately reflect simulated user
    await refreshUser();

    // Navigate to the target simulation landing page
    const destination = ROLE_ROUTES[normalizedRole] || '/dashboard';
    router.push(destination);
    router.refresh();
  }, [user, refreshUser, router]);

  /**
   * Stop simulation and return to admin portal
   */
  const stopSimulation = useCallback(async () => {
    // Clear simulation cookie
    document.cookie = "passi_impersonate_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";

    setIsSimulating(false);
    setSimulatedRole(null);

    await refreshUser();

    router.push('/admin');
    router.refresh();
  }, [refreshUser, router]);

  // Standardize the simulated user session object
  const simulatedUser: User | null = user && isSimulating && simulatedRole ? {
    ...user,
    id: user.id,
    email: user.email,
    role: simulatedRole as any,
    original_role: (user.original_role || user.role || 'admin').toLowerCase(),
    instagram_handle: user.instagram_handle || '@admin_simulated',
  } : user;

  return (
    <SimulationContext.Provider
      value={{
        isSimulating,
        simulatedRole,
        simulatedUser,
        startSimulation,
        stopSimulation,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
