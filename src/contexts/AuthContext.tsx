import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  role: string | null;
  business_id: string | null;
}

export interface Business {
  id: string;
  business_name: string | null;
  business_category: string | null;
  annual_turnover: number | null;
  vat_registered: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  business: Business | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadBusiness = useCallback(async (businessId: string) => {
    const { data, error } = await supabase
      .from("businesses")
      .select("id, business_name, business_category, annual_turnover, vat_registered")
      .eq("id", businessId)
      .maybeSingle();
    if (error) {
      console.error("business load error:", error);
      setBusiness(null);
    } else {
      setBusiness((data as Business) ?? null);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string, email?: string) => {
    console.log("Loading profile for user:", userId, "email:", email);
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name, phone, role, business_id")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("profile load error:", error);
        setProfile(null);
        setBusiness(null);
        return;
      }

      if (!data) {
        console.log("No profile found, creating one...");
        const { data: bizData, error: bizError } = await supabase
          .from("businesses")
          .insert({ business_name: "My Business", owner_id: userId })
          .select()
          .single();

        if (bizError) {
          console.error("business create error:", bizError);
          setProfile(null);
          setBusiness(null);
          return;
        }

        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: email ?? null,
            full_name: null,
            role: "owner",
            business_id: bizData.id,
          })
          .select()
          .single();

        if (profileError) {
          console.error("profile create error:", profileError);
          setProfile(null);
          setBusiness(null);
          return;
        }

        setProfile(newProfile as Profile);
        setBusiness(bizData as Business);
        return;
      }

      const p = data as Profile;
      setProfile(p);

      if (p.business_id) {
        await loadBusiness(p.business_id);
      } else {
        console.log("Profile has no business_id, creating business...");
        const { data: bizData, error: bizError } = await supabase
          .from("businesses")
          .insert({ business_name: "My Business", owner_id: userId })
          .select()
          .single();

        if (!bizError && bizData) {
          await supabase
            .from("profiles")
            .update({ business_id: bizData.id })
            .eq("id", userId);
          setBusiness(bizData as Business);
          setProfile({ ...p, business_id: bizData.id });
        } else {
          setBusiness(null);
        }
      }
    } finally {
      setProfileLoading(false);
    }
  }, [loadBusiness]);

  useEffect(() => {
    console.log("Initializing auth...");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("Auth state changed:", event);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (newSession?.user) {
        setTimeout(() => loadProfile(newSession.user.id, newSession.user.email), 0);
      } else {
        setProfile(null);
        setBusiness(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
      if (existingSession?.user) {
        loadProfile(existingSession.user.id, existingSession.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBusiness(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id, user.email);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        business,
        loading,
        profileLoading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};