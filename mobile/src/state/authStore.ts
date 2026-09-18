import { create } from 'zustand';

export type RoleName = 'SuperAdmin' | 'Company' | 'Manager' | 'Manager1' | 'Manager2';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  companyId: string | null;
  permissions?: string[];
};

export type CompanyInfo = {
  id: string;
  name: string;
  address?: string;
  ownerId?: string;
  maxManagers?: {
    manager1: number;
    manager2: number;
  };
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  companies: CompanyInfo[];
  selectedCompanyId: string | null;
  setAuth: (payload: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setCompanies: (companies: CompanyInfo[]) => void;
  setSelectedCompanyId: (companyId: string | null) => void;
  signOut: () => void;
  hasPermission: (permission: string) => boolean;
  canDownload: () => boolean;
};

export const authStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  companies: [],
  selectedCompanyId: null,

  setAuth: ({ user, accessToken, refreshToken }) =>
    set((state) => ({
      user,
      accessToken,
      refreshToken,
      selectedCompanyId: user.companyId || state.selectedCompanyId || null,
    })),

  setCompanies: (companies) =>
    set((state) => ({
      companies,
      selectedCompanyId: state.selectedCompanyId || (companies.length > 0 ? companies[0].id : null),
    })),

  setSelectedCompanyId: (companyId) => set({ selectedCompanyId: companyId }),

  signOut: () =>
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      companies: [],
      selectedCompanyId: null,
    }),

  hasPermission: (permission: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  },

  canDownload: () => {
    const user = get().user;
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    if (user.role === 'Manager' || user.role === 'Manager1' || user.role === 'Manager2') return false;
    return get().hasPermission('device_data.download');
  },
}));
