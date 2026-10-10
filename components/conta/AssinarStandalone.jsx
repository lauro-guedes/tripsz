"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { BG } from "../../lib/tokens";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Loading } from "../ui/Loading";
import { PassportPaywall } from "./PassportPaywall";
import { useEffect, useState } from "react";

export function AssinarStandalone({ onNavigate, onLogout }) {
  const [userInfo, setUserInfo] = useState(null); // null = carregando

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setUserInfo({
        userId: user?.id || null,
        userEmail: user?.email || null,
        userName: user?.user_metadata?.name || user?.email || "",
        userAvatar: user?.user_metadata?.avatar_url || null,
      });
    })();
  }, []);

  if (!userInfo) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="" userName="" userAvatar={null} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="" userName={userInfo.userName} userAvatar={userInfo.userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
      <PassportPaywall userId={userInfo.userId} userEmail={userInfo.userEmail} userName={userInfo.userName} userAvatar={userInfo.userAvatar} />
      <AuthedFooter />
    </div>
  );
}
