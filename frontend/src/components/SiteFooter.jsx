import { useLocation } from "react-router-dom";
import Footer from "@/components/Footer";

// Full-screen auth / setup flows are intentionally chromeless - no footer.
const HIDE_ON = ["/login", "/register", "/verify-email", "/onboarding"];

// One footer for the whole app so it's consistent on every page (never missing,
// never doubled). Individual pages must NOT render <Footer/> themselves.
export default function SiteFooter() {
  const { pathname } = useLocation();
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return <Footer />;
}
