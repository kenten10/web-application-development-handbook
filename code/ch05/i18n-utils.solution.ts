export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function formatDate(
  date: Date | number,
  locale: string,
  style: 'short' | 'medium' | 'long' | 'full' = 'medium',
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(date);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string,
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}

export type PluralMessages = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export function plural(value: number, locale: string, messages: PluralMessages): string {
  const category = value === 0 && messages.zero ? 'zero' : new Intl.PluralRules(locale).select(value);
  return (messages[category] ?? messages.other).replaceAll('{n}', new Intl.NumberFormat(locale).format(value));
}

export function formatList(
  values: readonly string[],
  locale: string,
  type: Intl.ListFormatType = 'conjunction',
): string {
  return new Intl.ListFormat(locale, { style: 'long', type }).format(values);
}

export const exerciseId = '5.5';
