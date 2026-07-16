import { Link } from "react-router-dom";

/**
 * Shared shell for policy / docs pages: consistent heading, prose styling,
 * and "last updated" line. The global <SiteFooter /> (App.js) renders the
 * footer, so this layout must not add its own or it doubles up.
 */
export default function LegalLayout({ title, updated, intro, children }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <Link to="/" className="text-sm text-zinc-500 hover:text-white transition-colors">&larr; Back to home</Link>
        <div className="label-caps mt-8 mb-2">Legal</div>
        <h1 className="font-display font-extrabold tracking-tight text-3xl sm:text-4xl lg:text-5xl">{title}</h1>
        {updated && <p className="text-sm text-zinc-500 mt-3">Last updated {updated}</p>}
        {intro && <p className="text-zinc-400 mt-6 text-base sm:text-lg leading-relaxed">{intro}</p>}
        <div className="mt-10 space-y-8 text-zinc-300 leading-relaxed [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-xl [&_h2]:text-white [&_h2]:mb-3 [&_p]:text-[15px] [&_p]:text-zinc-400 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:text-[15px] [&_li]:text-zinc-400 [&_a]:text-[#CCFF00] [&_a:hover]:underline">
          {children}
        </div>
      </div>
    </div>
  );
}
