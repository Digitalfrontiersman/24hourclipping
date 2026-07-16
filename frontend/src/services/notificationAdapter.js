// Toast wrapper over sonner. Branded icons + consistent copy across the app.
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

const ICON = "w-[18px] h-[18px] shrink-0";

export const notify = {
  success: (msg, desc) =>
    toast.success(msg, { description: desc, icon: <CheckCircle2 className={`${ICON} text-[#CCFF00]`} /> }),
  urgent: (msg, desc) =>
    toast.error(msg, { description: desc, icon: <AlertTriangle className={`${ICON} text-[#FF4500]`} /> }),
  info: (msg, desc) =>
    toast(msg, { description: desc, icon: <Info className={`${ICON} text-sky-400`} /> }),
};
