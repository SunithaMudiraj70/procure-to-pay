import { create } from 'zustand';

let toastIdCounter = 0;

export const useUiStore = create((set, get) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Toasts
  toasts: [],
  addToast: ({ type = 'info', title, message, duration = 4500 }) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`;
    const newToast = { id, type, title, message };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  // Confirm dialog for irreversible actions (reject, cancel PO, award)
  confirmDialog: {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger', // 'danger' | 'primary' | 'warning'
    onConfirm: null,
    onCancel: null
  },
  openConfirm: ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    onConfirm,
    onCancel
  }) => {
    set({
      confirmDialog: {
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        variant,
        onConfirm,
        onCancel
      }
    });
  },
  closeConfirm: () => {
    set((state) => ({
      confirmDialog: {
        ...state.confirmDialog,
        isOpen: false,
        onConfirm: null,
        onCancel: null
      }
    }));
  },

  // Notification preferences for settings
  notificationPrefs: {
    emailOnApproval: true,
    emailOnDelivery: true,
    browserAlerts: false,
    weeklyDigest: true
  },
  updateNotificationPref: (key, value) => {
    set((state) => ({
      notificationPrefs: {
        ...state.notificationPrefs,
        [key]: value
      }
    }));
  }
}));

export default useUiStore;
