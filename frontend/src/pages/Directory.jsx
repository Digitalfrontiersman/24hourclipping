import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import ClipperCard from "@/components/ClipperCard";
import ClipperCardSkeleton from "@/components/ClipperCardSkeleton";
import EmptyState from "@/components/EmptyState";
import Seo from "@/components/Seo";
import { Users } from "lucide-react";

export default function Directory() {
  const [clippers, setClippers] = useState(null);

  useEffect(() => {
    dbAdapter.getClippers().then(setClippers).catch(() => setClippers([]));
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <Seo title="Clipper directory" path="/clippers" description="Browse vetted, rated short-form video clippers on 24 Hour Clipping. Every clipper is manually vetted - hire by rating, on-time percentage and specialty." />
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        <span className="label-caps">Founding roster</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mt-2 mb-2">Clipper Directory</h1>
        <p className="text-zinc-500 mb-10">Every clipper is manually vetted. On-time percentage is the score that matters most.</p>
        {clippers === null ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <ClipperCardSkeleton key={i} />)}</div>
        ) : clippers.length === 0 ? (
          <EmptyState icon={Users} title="No clippers listed yet." hint="Our founding roster is being vetted. Check back soon - or apply to be one of the first." cta="Apply as a clipper" to="/register" />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clippers.map((c) => <ClipperCard key={c.id} clipper={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
