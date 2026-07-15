// Per-route metadata. React 19 hoists <title>/<meta>/<link> rendered anywhere in
// the tree into <head>, so this needs no external library. Helps JS-rendering
// crawlers (Google, Bing) and social/link unfurls get the right title + canonical.
const SITE = "https://24hourclipping.com";

export default function Seo({ title, description, path = "" }) {
  const full = title ? `${title} | 24 Hour Clipping` : "24 Hour Clipping - Get short-form clips made in 24 hours";
  const url = `${SITE}${path}`;
  return (
    <>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={full} />
      {description && <meta name="twitter:description" content={description} />}
    </>
  );
}
