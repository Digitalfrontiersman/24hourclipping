import { useState } from "react";

// Shows the user's avatar image; falls back to an on-brand initials circle when
// there's no image or the image fails to load, so an avatar is never blank.
export default function Avatar({ src, name, className = "w-9 h-9 text-xs" }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} rounded-full object-cover border border-white/10 bg-[#1A1A1A] shrink-0`}
      />
    );
  }
  return (
    <span className={`${className} rounded-full bg-[#CCFF00] text-black font-display font-bold flex items-center justify-center leading-none border border-white/10 shrink-0`}>
      {initial}
    </span>
  );
}
