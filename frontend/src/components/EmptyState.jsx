import { Link } from "react-router-dom";

/**
 * On-brand empty state: muted icon, a line of copy, and an optional lime CTA.
 * Usage: <EmptyState icon={LayoutGrid} title="No live contracts" hint="Post a clip to start the clock." cta="Post a clip" to="/customer/create" />
 */
export default function EmptyState({ icon: Icon, title, hint, cta, to, onAction, className = "" }) {
  return (
    <div className={`card-dark flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-zinc-500" />
        </div>
      )}
      <div className="font-display font-bold text-lg text-white">{title}</div>
      {hint && <p className="text-sm text-zinc-500 mt-1.5 max-w-xs">{hint}</p>}
      {cta && (to ? (
        <Link to={to} className="btn-lime h-11 px-6 text-sm mt-5">{cta}</Link>
      ) : (
        <button onClick={onAction} className="btn-lime h-11 px-6 text-sm mt-5">{cta}</button>
      ))}
    </div>
  );
}
