import { create } from 'zustand';

export type RoleName = 'SuperAdmin' | 'Company' | 'Manager' | 'Manager1' | 'Manager2';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  companyId: string | null;
  branch?: string;
  unit?: string;
  assignedDevices?: string[];
  permissions?: string[];
};

export type CompanyInfo = {
  id: string;
  name: string;
  address?: string;
  ownerId?: string;
  branches?: Array<{
    _id?: string;
    name: string;
    code?: string;
    address?: string;
    units: Array<{ _id?: string; name: string; description?: string }>;
  }>;
  maxManagers?: {
    total?: number;
    manager1?: number;
    manager2?: number;
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

function getSavedState(): Partial<AuthState> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem('aquaflow_auth');
      if (data) return JSON.parse(data);
    } catch (e) {}
  }
  return {};
}

function saveState(state: Partial<AuthState>) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        'aquaflow_auth',
        JSON.stringify({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          companies: state.companies,
          selectedCompanyId: state.selectedCompanyId,
        })
      );
    } catch (e) {}
  }
}

const saved = getSavedState();

export const authStore = create<AuthState>((set, get) => ({
  user: saved.user || null,
  accessToken: saved.accessToken || null,
  refreshToken: saved.refreshToken || null,
  companies: saved.companies || [],
  selectedCompanyId: saved.selectedCompanyId || null,

  setAuth: ({ user, accessToken, refreshToken }) =>
    set((state) => {
      const next = {
        user,
        accessToken,
        refreshToken,
        selectedCompanyId: user.companyId || state.selectedCompanyId || null,
      };
      saveState({ ...state, ...next });
      return next;
    }),

  setCompanies: (companies) =>
    set((state) => {
      const next = {
        companies,
        selectedCompanyId: state.selectedCompanyId || (companies.length > 0 ? companies[0].id : null),
      };
      saveState({ ...state, ...next });
      return next;
    }),

  setSelectedCompanyId: (companyId) =>
    set((state) => {
      const next = { selectedCompanyId: companyId };
      saveState({ ...state, ...next });
      return next;
    }),

  signOut: () => {
    const next = {
      user: null,
      accessToken: null,
      refreshToken: null,
      companies: [],
      selectedCompanyId: null,
    };
    saveState(next);
    set(next);
  },

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
