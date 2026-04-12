import { useEffect, useState } from "react";
import { supabase } from "@smileguard/supabase-client";
import { CurrentUser } from "../types/index";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          role: session.user.user_metadata?.role,
        });
      }
    });

    // Subscribe to auth state changes - THIS IS CRITICAL
    // This hook will now update when user logs in/out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_OUT") {
          console.log("[useCurrentUser] User signed out");
          setUser(null);
        } else if (session?.user) {
          console.log("[useCurrentUser] Auth state changed, updating user:", session.user.id);
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            role: session.user.user_metadata?.role,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return user;
}
