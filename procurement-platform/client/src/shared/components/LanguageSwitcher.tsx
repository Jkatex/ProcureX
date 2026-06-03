import { MenuItem, Select } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { persistLanguage, type SupportedLanguage } from '@/i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const language = i18n.language === 'sw' ? 'sw' : 'en';

  async function handleChange(nextLanguage: SupportedLanguage) {
    await i18n.changeLanguage(nextLanguage);
    persistLanguage(nextLanguage);
  }

  return (
    <Select
      aria-label={t('language')}
      value={language}
      size="small"
      onChange={(event) => void handleChange(event.target.value as SupportedLanguage)}
      renderValue={(value) => (value === 'sw' ? 'SW' : 'EN')}
      sx={{
        minWidth: 74,
        background: '#fff',
        '& .MuiSelect-select': {
          minHeight: 'auto',
          py: 0.75,
          pr: '28px !important',
          pl: 1.25,
          fontSize: '0.82rem',
          fontWeight: 800
        }
      }}
    >
      <MenuItem value="en">{t('english')}</MenuItem>
      <MenuItem value="sw">{t('swahili')}</MenuItem>
    </Select>
  );
}
