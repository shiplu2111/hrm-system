import { useCallback, useMemo, useState } from 'react';

export type FormErrors<T> = Partial<Record<keyof T, string>>;

/** Small form-state helper: errors are always computed, but only shown once a field is touched. */
export function useOrgForm<T extends object>(
  initial: T,
  validate: (values: T) => FormErrors<T>,
) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const errors = useMemo(() => validate(values), [validate, values]);
  const isValid = Object.values(errors).every((e) => !e);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const touch = useCallback((key: keyof T) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const touchAll = useCallback(() => {
    setTouched(
      Object.fromEntries(Object.keys(values).map((k) => [k, true])) as Record<keyof T, boolean>,
    );
  }, [values]);

  const reset = useCallback((next: T) => {
    setValues(next);
    setTouched({});
  }, []);

  const showError = useCallback(
    (key: keyof T) => (touched[key] ? errors[key] : undefined),
    [touched, errors],
  );

  return { values, setField, touch, touchAll, reset, errors, showError, isValid };
}
