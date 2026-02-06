import { Palette } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
      title={theme === 'navy' ? 'Cambiar a tema Azul' : 'Cambiar a tema Navy/Dorado'}
    >
      <Palette className="w-4 h-4" />
    </button>
  );
}
