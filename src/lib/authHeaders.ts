import type { AuthSpace } from '../types';

const TOKEN_KEYS: Record<AuthSpace, string> = {
  intranet: 'tpd_intranet_token',
  accounting: 'tpd_acc_token',
  learner: 'tpd_learner_token',
  instructor: 'tpd_instructor_token',
  provider: 'tpd_provider_token',
  superadmin: 'tpd_superadmin_token',
};

export function getSpaceToken(space?: AuthSpace): string | null {
  try {
    if (space) {
      const specific = sessionStorage.getItem(TOKEN_KEYS[space]);
      if (specific) return specific;
    }
    return sessionStorage.getItem('tpd_active_token');
  } catch {
    return null;
  }
}

export function clearAllSpaceTokens(): void {
  try {
    sessionStorage.removeItem('tpd_portal_session');
    sessionStorage.removeItem('tpd_active_token');
    sessionStorage.removeItem('tpd_active_space');
    Object.values(TOKEN_KEYS).forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

export function setSpaceToken(space: AuthSpace, token: string): void {
  clearAllSpaceTokens();
  try {
    sessionStorage.setItem(TOKEN_KEYS[space], token);
    sessionStorage.setItem('tpd_active_token', token);
    sessionStorage.setItem('tpd_active_space', space);
  } catch {
    // ignore storage errors
  }
}

export function buildAuthHeaders(space?: AuthSpace, includeJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  const resolvedSpace =
    space ||
    ((() => {
      try {
        return (sessionStorage.getItem('tpd_active_space') as AuthSpace | null) || undefined;
      } catch {
        return undefined;
      }
    })());
  if (resolvedSpace) {
    headers['X-Active-Space'] = resolvedSpace;
  }
  const token = getSpaceToken(resolvedSpace);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
