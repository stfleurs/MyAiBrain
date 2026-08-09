export function verifyAuthToken(
  token: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!expected || !token) {
    return false;
  }
  return token === expected;
}
