import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { ThemeMode, useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'segmented';
  className?: string;
  onChange?: (nextTheme: ThemeMode) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  className = '',
  onChange,
}) => {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const handleToggle = () => {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    toggleTheme();
    onChange?.(next);
  };

  const handleSelect = (mode: ThemeMode) => {
    if (mode === theme) return;
    setTheme(mode);
    onChange?.(mode);
  };

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label={t('settings.appearance')}
        className={`inline-flex items-center p-0.5 rounded-xl bg-[#EFE9FB] dark:bg-[#0F0A20] border border-[#7928CA]/20 dark:border-[#A855F7]/30 shrink-0 ${className}`}
      >
        <button
          type="button"
          onClick={() => handleSelect('light')}
          aria-pressed={theme === 'light'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[10px] text-[10px] font-bold transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
              : 'text-[#5E5278] dark:text-zinc-400 hover:text-[#140D26] dark:hover:text-white'
          }`}
        >
          <Sun className="w-3 h-3" />
          <span>{t('settings.themeLight')}</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelect('dark')}
          aria-pressed={theme === 'dark'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[10px] text-[10px] font-bold transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
              : 'text-[#5E5278] dark:text-zinc-400 hover:text-[#140D26] dark:hover:text-white'
          }`}
        >
          <Moon className="w-3 h-3" />
          <span>{t('settings.themeDark')}</span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    const label = isDark ? t('nav.switchToLight') : t('nav.switchToDark');
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={label}
        aria-label={label}
        aria-pressed={!isDark}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border bg-white/90 dark:bg-[#1F1338] text-[#140D26] dark:text-zinc-200 border-[#7928CA]/20 dark:border-[#A855F7]/30 hover:border-[#A855F7]/60 shadow-sm ${className}`}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-[#7928CA]" />
        )}
        <span>{isDark ? t('settings.themeLight') : t('settings.themeDark')}</span>
      </button>
    );
  }

  const label = isDark ? t('nav.switchToLight') : t('nav.switchToDark');
  return (
    <button
      type="button"
      onClick={handleToggle}
      title={label}
      aria-label={label}
      aria-pressed={!isDark}
      className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-white/90 dark:bg-[#1A1133]/85 backdrop-blur-md border border-[#7928CA]/20 dark:border-white/10 flex items-center justify-center text-[#7928CA] dark:text-amber-300 hover:border-[#A855F7]/60 active:scale-95 transition-all cursor-pointer shadow-md shadow-purple-900/10 dark:shadow-black/30 ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-200" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-200" />
      )}
    </button>
  );
};
