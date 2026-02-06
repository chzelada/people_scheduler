import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'navy' | 'blue';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const applyTheme = (theme: Theme) => {
  if (theme === 'blue') {
    document.documentElement.setAttribute('data-theme', 'blue');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'navy',

      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'navy' ? 'blue' : 'navy';
        applyTheme(newTheme);
        set({ theme: newTheme });
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);
