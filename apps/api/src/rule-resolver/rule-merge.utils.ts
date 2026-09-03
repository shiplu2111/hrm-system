function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeValues(
  base: unknown,
  override: unknown,
): unknown {
  if (override === undefined) {
    return base;
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(override)) {
      merged[key] = key in merged
        ? mergeValues(merged[key], value)
        : value;
    }

    return merged;
  }

  return override;
}

/** Deep-merge payloads; later layers in the chain override earlier ones. */
export function mergeRulePayloads(
  layers: Array<Record<string, unknown> | null | undefined>,
): Record<string, unknown> {
  return layers.reduce<Record<string, unknown>>((accumulator, layer) => {
    if (!layer) {
      return accumulator;
    }

    return mergeValues(accumulator, layer) as Record<string, unknown>;
  }, {});
}

export function toRecordPayload(payload: unknown): Record<string, unknown> {
  if (isPlainObject(payload)) {
    return payload;
  }

  return {};
}
