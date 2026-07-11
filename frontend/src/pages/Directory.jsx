import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import ClipperCard from "@/components/ClipperCard";
import Footer from "@/components/Footer";

export default function Directory() {
  const [clippers, setClippers] = useState(null);

  useEffect(() => {
    dbAdapter.getClippers().then(setClippers).catch(() => setClippers([]));
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <span className="label-caps">Founding roster</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mt-2 mb-2">Clipper Directory</h1>
        <p className="text-zinc-500 mb-10">Every clipper is manually vetted. On-time percentage is the score that matters most.</p>
        {clippers === null ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <div key={i} className="card-dark h-80 animate-pulse" />)}</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clippers.map((c) => <ClipperCard key={c.id} clipper={c} />)}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
