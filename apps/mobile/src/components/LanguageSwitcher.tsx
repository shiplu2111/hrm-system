import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTranslation, useLanguageSwitcher } from '@hrm/i18n';

export function LanguageSwitcher() {
  const { t } = useAppTranslation();
  const { language, setLanguage, languages } = useLanguageSwitcher(async (next) => {
    const { setStoredLanguage } = await import('../db/session-repository');
    await setStoredLanguage(next);
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('common.language')}</Text>
      <View style={styles.row}>
        {languages.map((item) => (
          <Pressable
            key={item.code}
            style={[styles.chip, language === item.code && styles.chipActive]}
            onPress={() => void setLanguage(item.code)}
          >
            <Text style={[styles.chipText, language === item.code && styles.chipTextActive]}>
              {t(item.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 6 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c4a6e',
  },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#e0f2fe' },
});
