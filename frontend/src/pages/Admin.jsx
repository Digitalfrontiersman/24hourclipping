import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { notify } from "@/services/notificationAdapter";
import Countdown from "@/components/Countdown";
import StatusBadge from "@/components/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import Avatar from "@/components/Avatar";
import { LifeBuoy, Ban, RotateCcw, AlertTriangle, RefreshCw, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const ALL_ROLES = ["customer", "clipper", "admin"];

const ROLE_COLORS = {
  customer: "bg-[#CCFF00]/15 text-[#CCFF00]",
  clipper: "bg-sky-400/15 text-sky-300",
  admin: "bg-[#FF4500]/15 text-[#FF4500]",
};

export default function Admin() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = () => dbAdapter.adminUsers().then(setUsers).catch(() => {});
  const load = () => {
    dbAdapter.adminOverview().then(setData).catch(() => {});
    loadUsers();
  };
  useEffect(() => { load(); }, []);

  const userAction = (u) => {
    const fn = u.disabled ? dbAdapter.restoreUser : dbAdapter.suspendUser;
    fn(u.id)
      .then(() => { notify[u.disabled ? "success" : "urgent"](u.disabled ? `${u.name} restored` : `${u.name} suspended`); loadUsers(); })
      .catch((e) => notify.urgent(e.response?.data?.detail || "Action failed"));
  };

  const confirmDelete = () => {
    const u = pendingDelete;
    if (!u) return;
    setDeleting(true);
    dbAdapter.deleteUser(u.id)
      .then((r) => { notify.success(`${r.deleted || u.name || "User"} deleted`); setPendingDelete(null); loadUsers(); })
      .catch((e) => notify.urgent(e.response?.data?.detail || "Could not delete user"))
      .finally(() => setDeleting(false));
  };

  const toggleRole = (u, role) => {
    const has = (u.roles || []).includes(role);
    const roles = has ? (u.roles || []).filter((r) => r !== role) : [...(u.roles || []), role];
    dbAdapter.setUserRoles(u.id, roles)
      .then(() => { notify.success(`${u.name || "User"} roles updated`); loadUsers(); })
      .catch((e) => notify.urgent(e.response?.data?.detail || "Could not update roles"));
  };

  if (!data) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-5xl h-96 mx-4 animate-pulse" /></div>;
  const { stats, contracts, projects, bids, clippers } = data;
  const rescues = contracts.filter((c) => c.status === "rescue");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <span className="label-caps text-[#FF4500]">Private console</span>
            <h1 className="text-3xl font-extrabold tracking-tighter mt-2">Admin Console</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button data-testid="admin-refresh" className="btn-ghost h-10 px-5 text-xs" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link to="/customer/create" data-testid="admin-create-job" className="btn-lime h-10 px-5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Create job
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {[["Users", stats.total_users, "text-[#CCFF00]"], ["Projects", stats.total_projects], ["Open", stats.open_projects], ["Live", stats.live_contracts, "text-[#CCFF00]"], ["Rescue", stats.rescue_mode, "text-[#FF4500]"], ["Bids", stats.total_bids], ["Fees", `$${stats.fees_earned}`, "text-[#CCFF00]"], ["Bonds locked", `$${stats.bonds_locked}`]].map(([l, v, cls]) => (
            <div key={l} className="card-dark p-4">
              <div className={`font-mono text-xl font-extrabold ${cls || ""}`}>{v}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        {rescues.length > 0 && (
          <div className="card-dark border-[#FF4500]/50 p-5 mb-8" data-testid="admin-rescue-alert">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FF4500]" />
              <p className="text-sm"><span className="font-bold">{rescues.length} contract in Rescue Mode.</span> <span className="text-zinc-400">{rescues[0].project?.title} - {rescues[0].clipper?.name} missed the deadline. Refund + bond credit processed.</span></p>
            </div>
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList className="bg-[#1A1A1A] border border-white/10 mb-6 flex-wrap h-auto">
            {["users", "contracts", "projects", "bids", "clippers"].map((t) => (
              <TabsTrigger key={t} value={t} data-testid={`admin-tab-${t}`} className="data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="users">
            <div className="space-y-2" data-testid="admin-users-list">
              {users.length === 0 && <p className="text-sm text-zinc-500 py-6 text-center">No users yet.</p>}
              {users.map((u) => (
                <div key={u.id} className="card-dark p-4 flex items-center gap-4 flex-wrap" data-testid={`admin-user-${u.id}`}>
                  <Avatar src={u.avatar} name={u.name || u.email} className="w-9 h-9 text-sm" />
                  <div className="flex-1 min-w-48">
                    <p className="font-bold text-sm">{u.name} {u.disabled && <span className="text-[#FF4500] text-xs">(SUSPENDED)</span>}</p>
                    <p className="text-xs text-zinc-500">{u.email} · joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"} · via {u.auth_provider || "local"}</p>
                  </div>
                  <div className="flex items-center gap-1.5" data-testid={`admin-user-roles-${u.id}`} title="Click a role to grant or revoke it">
                    {ALL_ROLES.map((r) => {
                      const on = (u.roles || []).includes(r);
                      return (
                        <button key={r} onClick={() => toggleRole(u, r)}
                          className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors ${on ? `${ROLE_COLORS[r]} border-transparent` : "border-white/10 text-zinc-600 hover:text-white hover:border-white/25"}`}>
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  {!(u.roles || []).includes("admin") && (
                    <div className="flex items-center gap-1.5">
                      <button data-testid={`admin-user-toggle-${u.id}`} className={`h-9 px-4 text-xs font-bold rounded-full transition-colors ${u.disabled ? "bg-[#CCFF00] text-black" : "border border-[#FF4500]/40 text-[#FF4500] hover:bg-[#FF4500]/10"}`}
                        onClick={() => userAction(u)}>
                        {u.disabled ? <><RotateCcw className="w-3.5 h-3.5 inline mr-1" />Restore</> : <><Ban className="w-3.5 h-3.5 inline mr-1" />Suspend</>}
                      </button>
                      <button data-testid={`admin-user-delete-${u.id}`} title="Delete user permanently"
                        className="h-9 w-9 flex items-center justify-center rounded-full border border-white/10 text-zinc-500 hover:text-[#FF4500] hover:border-[#FF4500]/40 transition-colors"
                        onClick={() => setPendingDelete(u)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contracts">
            <div className="space-y-3">
              {contracts.map((c) => (
                <div key={c.id} className="card-dark p-4 flex items-center gap-4 flex-wrap" data-testid={`admin-contract-${c.id}`}>
                  <div className="flex-1 min-w-48">
                    <p className="font-bold text-sm">{c.project?.title}</p>
                    <p className="text-xs text-zinc-500">{c.clipper?.name} · ${c.price} · Bond ${c.bond} · {c.payment_method?.toUpperCase()}</p>
                  </div>
                  {c.status === "live" && <span className="font-mono text-sm"><Countdown deadline={c.deadline_at} /></span>}
                  <StatusBadge status={c.status} />
                  {c.status === "live" && (
                    <button data-testid={`admin-trigger-rescue-${c.id}`} className="btn-ghost h-9 px-4 text-xs text-[#FF4500] border-[#FF4500]/40"
                      onClick={() => dbAdapter.triggerRescue(c.id).then(() => { notify.urgent("Rescue Mode triggered", "Refund simulated, bond credited to customer"); load(); })}>
                      <LifeBuoy className="w-3.5 h-3.5" /> Trigger Rescue
                    </button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="card-dark p-4 flex items-center gap-4 flex-wrap">
                  <img src={p.thumbnail} alt="" className="w-16 aspect-video object-cover rounded-lg" />
                  <div className="flex-1 min-w-48"><p className="font-bold text-sm">{p.title}</p><p className="text-xs text-zinc-500">{p.customer_name} · ${p.budget} · {p.bids_count} bids · {p.funded ? "FUNDED" : "UNFUNDED"}</p></div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bids">
            <div className="space-y-3">
              {bids.map((b) => (
                <div key={b.id} className="card-dark p-4 flex items-center gap-4 flex-wrap text-sm">
                  <span className="font-mono font-bold text-[#CCFF00]">${b.amount}</span>
                  <span className="flex-1 text-zinc-400 text-xs truncate">“{b.pitch}”</span>
                  <span className="text-xs text-zinc-500">ETA {b.eta_hours}h · Bond ${b.bond_required}</span>
                  <StatusBadge status={b.status === "pending" ? "open" : b.status} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="clippers">
            <div className="space-y-3">
              {clippers.map((cl) => (
                <div key={cl.id} className="card-dark p-4 flex items-center gap-4 flex-wrap" data-testid={`admin-clipper-${cl.id}`}>
                  <img src={cl.avatar} alt="" className="w-10 h-10 rounded-full" />
                  <div className="flex-1 min-w-40"><p className="font-bold text-sm">{cl.name}</p><p className="text-xs text-zinc-500">{cl.specialty} · {cl.on_time_pct}% on-time · {cl.completed_jobs} jobs</p></div>
                  <span className="text-xs text-zinc-500">Manage account status on the Users tab</span>
                </div>
              ))}
            </div>
          </TabsContent>

        </Tabs>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent className="bg-[#141414] border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {pendingDelete?.name || "this user"}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This permanently removes <span className="text-zinc-200">{pendingDelete?.email}</span> and their bids and messages. It can't be undone.
              Accounts with projects, contracts or payment history can't be deleted - suspend those instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/15 text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="admin-user-delete-confirm" disabled={deleting}
              className="bg-[#FF4500] text-white hover:bg-[#E63E00]" onClick={confirmDelete}>
              {deleting ? "Deleting…" : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
