export function excludeSensitiveFields<T extends Record<string, any>>(
  user: T,
  fields: string[] = ['passwordHash', 'failedLoginAttempts', 'lockedUntil'],
): Omit<T, string> {
  return Object.fromEntries(
    Object.entries(user).filter(([key]) => !fields.includes(key)),
  ) as Omit<T, string>;
}
