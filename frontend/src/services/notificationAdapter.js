// MOCK NOTIFICATION ADAPTER - toast wrapper. Replace with push/email service later.
import { toast } from "sonner";

export const notify = {
  success: (msg, desc) => toast.success(msg, { description: desc, style: { borderColor: "#CCFF00" } }),
  urgent: (msg, desc) => toast.error(msg, { description: desc, style: { borderColor: "#FF4500" } }),
  info: (msg, desc) => toast(msg, { description: desc }),
};
