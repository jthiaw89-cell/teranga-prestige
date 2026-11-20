import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import type { AuthSessionSummary } from '../types';
import { buildAuthHeaders } from './authHeaders';
import { auth } from './firebase';
import {
  attachWorkspaceListeners,
  ensureUserAndWorkspace,
  hydrateWorkspaceFromFirestore,
  syncBackendSnapshotToFirestore,
} from './firestoreStore';

interface FirebaseContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  workspaceId: string | null;
  syncWorkspaceNow: (session: AuthSessionSummary) => Promise<void>;
  signOutFirebase: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  firebaseUser: null,
  authReady: false,
  workspaceId: null,
  syncWorkspaceNow: async () => {},
  signOutFirebase: async () => {},
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSyncContextRef = useRef<{ wsId: string; uid: string; headers: Record<string, string> } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setWorkspaceId(null);
        activeSyncContextRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  // Intercept successful API mutations when authenticated with verified Firebase user
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();
      if (
        response.ok &&
        url.includes('/api/') &&
        !url.includes('/api/auth/') &&
        !url.includes('/api/persistence/') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        activeSyncContextRef.current
      ) {
        const ctx = activeSyncContextRef.current;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          void syncBackendSnapshotToFirestore(ctx.wsId, ctx.uid, ctx.headers).catch((err) => {
            console.warn('[Firestore Sync]', err);
          });
        }, 500);
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const syncWorkspaceNow = useCallback(
    async (session: AuthSessionSummary) => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) return;

      const wsId = await ensureUserAndWorkspace(user, session);
      setWorkspaceId(wsId);
      const headers = buildAuthHeaders(session.space, false);
      activeSyncContextRef.current = { wsId, uid: user.uid, headers };

      const { hydratedCount } = await hydrateWorkspaceFromFirestore(wsId, user.uid, headers);
      if (hydratedCount === 0) {
        await syncBackendSnapshotToFirestore(wsId, user.uid, headers);
      }
    },
    [],
  );

  // Attach real-time listeners only when auth is ready and user is authenticated & verified
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified || !workspaceId) return;
    const unsub = attachWorkspaceListeners(workspaceId, firebaseUser.uid, () => {
      // Realtime Firestore listener active
    });
    return () => unsub();
  }, [authReady, firebaseUser, workspaceId]);

  const signOutFirebase = useCallback(async () => {
    activeSyncContextRef.current = null;
    setWorkspaceId(null);
    await signOut(auth);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        authReady,
        workspaceId,
        syncWorkspaceNow,
        signOutFirebase,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};
