/**
 * Consistent marketing/section heading: an optional caps eyebrow over a title,
 * with uniform spacing. Keeps every section title on one typographic scale.
 */
export default function SectionHeading({ eyebrow, title, sub, align = "left", className = "" }) {
  const alignCls = align === "center" ? "text-center mx-auto items-center" : "text-left items-start";
  return (
    <div className={`flex flex-col ${alignCls} ${className}`}>
      {eyebrow && <div className="label-caps mb-2">{eyebrow}</div>}
      <h2 className="font-display font-extrabold tracking-tight text-3xl sm:text-4xl lg:text-5xl text-white">{title}</h2>
      {sub && <p className="text-zinc-400 mt-3 max-w-xl text-base sm:text-lg">{sub}</p>}
    </div>
  );
}
