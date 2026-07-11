import { useEffect, useRef } from "react";

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Renders the official Google Identity Services button. Renders nothing when
// REACT_APP_GOOGLE_CLIENT_ID is not configured, so the app works without it.
export default function GoogleButton({ onCredential }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "filled_black",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    };
    const id = "gis-client-script";
    if (document.getElementById(id)) {
      init();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.id = id;
    s.onload = init;
    document.body.appendChild(s);
  }, [onCredential]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex justify-center" />;
}
