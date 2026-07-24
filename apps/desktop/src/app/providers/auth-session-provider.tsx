import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState
} from "react";

import type {
  AuthSession
} from "@argin/security";

interface AuthSessionContextValue {
  session: AuthSession | null;
  setSession(session: AuthSession): void;
  clearSession(): void;
}

const AuthSessionContext = createContext<
  AuthSessionContextValue | undefined
>(undefined);

export function AuthSessionProvider({
  children
}: PropsWithChildren) {
  const [session, setSessionState] =
    useState<AuthSession | null>(null);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      session,
      setSession: setSessionState,
      clearSession: () => {
        setSessionState(null);
      }
    }),
    [session]
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (context === undefined) {
    throw new Error(
      "useAuthSession must be used inside AuthSessionProvider."
    );
  }

  return context;
}
