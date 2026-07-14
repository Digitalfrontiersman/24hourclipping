import { useEffect, useState } from "react";

function diff(deadline) {
  const ms = new Date(deadline) - new Date();
  return Math.floor(ms / 1000);
}

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

export default function Countdown({ deadline, size = "sm", onExpire }) {
  const [secs, setSecs] = useState(() => diff(deadline));

  useEffect(() => {
    const t = setInterval(() => {
      const s = diff(deadline);
      setSecs(s);
      if (s <= 0 && onExpire) onExpire();
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, onExpire]);

  const expired = secs <= 0;
  const urgent = secs > 0 && secs < 3600;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const color = expired ? "text-[#FF4500]" : urgent ? "text-[#FF4500]" : "text-white";

  if (size === "lg")
    return (
      <div data-testid="countdown-large" className={`font-mono font-extrabold tracking-tighter ${color} ${urgent ? "heartbeat" : ""} text-6xl sm:text-8xl`}>
        {expired ? "00:00:00" : `${pad(h)}:${pad(m)}:${pad(s)}`}
      </div>
    );
  return (
    <span data-testid="countdown-small" className={`font-mono font-bold ${expired || urgent ? "text-[#FF4500]" : "text-white"} ${urgent ? "heartbeat" : ""}`}>
      {expired ? "EXPIRED" : `${pad(h)}:${pad(m)}:${pad(s)}`}
    </span>
  );
}
