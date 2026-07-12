import { useRef, useState } from "react";
import { Upload, Check, Loader2 } from "lucide-react";

// Reusable drag-and-drop file input with progress + done states.
// Matches the dark + lime design system. `uploading` is a number 0-100 (or null).
export default function FileDropzone({
  onFile,
  uploading = null,
  doneName = null,
  title = "Drop your file here or click to upload",
  hint = "Drag & drop or click to browse",
  accept = "video/*",
  wrapperTestId = "dropzone",
  inputTestId = "dropzone-input",
  compact = false,
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const busy = uploading !== null;

  const pick = (file) => {
    if (file && !busy) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={wrapperTestId}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      className={`card-dark border-dashed text-center cursor-pointer transition-colors block outline-none ${compact ? "p-6" : "p-8"} ${
        drag ? "border-[#CCFF00] bg-[#CCFF00]/5" : doneName ? "border-[#CCFF00]/50" : "hover:border-[#CCFF00]/40 focus:border-[#CCFF00]/40"
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" data-testid={inputTestId} onChange={(e) => pick(e.target.files?.[0])} />

      {busy ? (
        <>
          <Loader2 className="w-6 h-6 mx-auto mb-2 text-[#CCFF00] animate-spin" />
          <span className="text-sm font-bold">Uploading… {uploading}%</span>
          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#CCFF00] transition-[width]" style={{ width: `${uploading}%` }} />
          </div>
        </>
      ) : doneName ? (
        <>
          <Check className="w-6 h-6 mx-auto mb-2 text-[#CCFF00]" />
          <span className="text-sm font-bold block truncate">{doneName}</span>
          <span className="text-xs text-[#CCFF00] mt-1 block">Uploaded · click to replace</span>
        </>
      ) : (
        <>
          <Upload className={`mx-auto mb-2 text-[#CCFF00] ${drag ? "w-7 h-7" : "w-6 h-6"} transition-all`} />
          <span className="text-sm font-bold">{drag ? "Release to upload" : title}</span>
          {hint && <span className="text-xs text-zinc-500 mt-1 block">{hint}</span>}
        </>
      )}
    </div>
  );
}
