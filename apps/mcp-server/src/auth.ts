const BEARER_PATTERN = /^Bearer\s+(.+)$/;

export function verifyAuthToken(
  authorization: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!expected || !authorization) {
    return false;
  }
  const match = BEARER_PATTERN.exec(authorization);
  if (!match) {
    return false;
  }
  return match[1] === expected;
}
