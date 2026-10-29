import { create } from 'zustand';

const STORAGE_KEY = 'procure_session_user';

const defaultUser = {
  id: 'RQT-000015',
  name: 'Alice Requester',
  role: 'requester',
  approvalLevel: null,
  departmentId: 'DEP-001',
  email: 'alice.requester@enterprise.com'
};

const loadStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUser;
    const user = JSON.parse(raw);
    if (user?.role === 'requester' && (user?.id === 'RQT-000001' || user?.name === 'Alice Requester')) {
      const updated = {
        ...user,
        id: 'RQT-000015',
        name: 'Alice Requester',
        email: 'alice.requester@enterprise.com',
        departmentId: 'DEP-001'
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    }
    return user;
  } catch (e) {
    console.error('Failed to parse stored session user:', e);
    return defaultUser;
  }
};

export const useSessionStore = create((set) => ({
  currentUser: loadStoredUser(),

  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to persist session user:', e);
    }
    set({ currentUser: user });
  },

  clearUser: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ currentUser: null });
  }
}));

export default useSessionStore;
