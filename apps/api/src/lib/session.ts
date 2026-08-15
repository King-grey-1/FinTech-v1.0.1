export interface AuthSession {
  userId: string;
  email: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
}

export function createSession(userId: string, email: string, role: string): AuthSession {
  const now = Date.now();
  return {
    userId,
    email,
    role,
    issuedAt: now,
    expiresAt: now + 1000 * 60 * 60 * 12,
  };
}

export function isSessionExpired(session: AuthSession): boolean {
  return Date.now() > session.expiresAt;
}
