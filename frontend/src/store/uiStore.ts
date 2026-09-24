import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}

interface UiState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  sidebarOpen: boolean;
  toasts: Toast[];
  online: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setOnline: (online: boolean) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const STORAGE_KEY = 'edurewards.theme';

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? systemTheme() : theme;
}

function applyTheme(theme: Theme) {
  const resolved = resolve(theme);
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem(STORAGE_KEY, theme);
  return resolved;
}

const initialTheme = ((localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system');

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: applyTheme(initialTheme),
  sidebarOpen: false,
  toasts: [],
  online: navigator.onLine,

  setTheme: (theme) => set({ theme, resolvedTheme: applyTheme(theme) }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  setOnline: (online) => set({ online }),

  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => get().dismissToast(id), toast.variant === 'error' ? 7000 : 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useUiStore.getState().pushToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) => useUiStore.getState().pushToast({ title, description, variant: 'error' }),
  info: (title: string, description?: string) => useUiStore.getState().pushToast({ title, description, variant: 'info' }),
  warning: (title: string, description?: string) => useUiStore.getState().pushToast({ title, description, variant: 'warning' }),
};
