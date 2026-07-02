import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  role: string;
  business_id: string | null;
}

interface Business {
  id: string;
  business_name: string;
  business_category: string | null;
  annual_turnover: number | null;
  vat_registered: boolean;
  currency: string | null;
  alert_threshold: number | null;
  owner_id: string;
  owner_email: string | null;
  whatsapp_number: string | null;
  logo_url: string | null;
  welcome_sent_at: string | null;
  street_address: string | null;
  city: string | null;
  county: string | null;
  postal_code: string | null;
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  business: null,
  loading: true,
  profileLoading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadBusiness = async (businessId: string) => {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();
    if (data) setBusiness(data as Business);
  };

  const loadProfile = async (userId: string, email?: string | null, currentSession?: Session | null) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name, phone, role, business_id")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setProfile(null);
        setBusiness(null);
        return;
      }

      if (!data) {
        // New user — create business with real data from signup metadata
        const metadata = currentSession?.user?.user_metadata || {};
        const companyName = metadata.company_name || "My Business";
        const phone = metadata.phone || null;

        const { data: bizData, error: bizError } = await supabase
          .from("businesses")
          .insert({
            business_name: companyName,
            owner_id: userId,
            owner_email: email ?? currentSession?.user?.user_metadata?.email ?? null,
            whatsapp_number: phone,
          })
          .select()
          .single();

        if (bizError) {
          setProfile(null);
          setBusiness(null);
          return;
        }

        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: email ?? null,
            full_name: metadata.full_name ?? null,
            company_name: companyName,
            phone: phone,
            role: "owner",
            business_id: bizData.id,
          })
          .select()
          .single();

        if (profileError) {
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
        // Profile exists but no business — create one
        const metadata = currentSession?.user?.user_metadata || {};
        const companyName = metadata.company_name || "My Business";
        const phone = metadata.phone || null;

        const { data: bizData, error: bizError } = await supabase
          .from("businesses")
          .insert({
            business_name: companyName,
            owner_id: userId,
            owner_email: email ?? currentSession?.user?.user_metadata?.email ?? null,
            whatsapp_number: phone,
          })
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
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id, user.email, session);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id, session.user.email, session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id, session.user.email, session);
        } else {
          setProfile(null);
          setBusiness(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, business,
      loading, profileLoading,
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};