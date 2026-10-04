import { useEffect, useState } from "react";
import { Badge, Card, Table } from "@/components/UI";
import { supabase } from "@/lib/supabase";

type Profile = { id:string; name:string|null; email:string|null; created_at:string };
type Role = { user_id:string; role:string };
function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "Hidden";
  return `${local.slice(0, 1)}•••@${domain}`;
}
export function AdminUsersPage() {
  const [users,setUsers]=useState<(Profile & {role:string})[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let cancelled=false;
    Promise.all([supabase!.from("profiles").select("id,name,email,created_at").order("created_at",{ascending:false}).limit(500),supabase!.from("user_roles").select("user_id,role")]).then(([profiles,roles])=>{
      if(cancelled)return;
      if(profiles.error||roles.error)setError("User directory is unavailable. Check admin access and database policies.");
      else {
        const roleMap=new Map(((roles.data||[]) as Role[]).map(r=>[r.user_id,r.role]));
        setUsers(((profiles.data||[]) as Profile[]).map(p=>({...p,role:roleMap.get(p.id)||"user"})));
      }
      setLoading(false);
    });
    return()=>{cancelled=true;};
  },[]);
  return <div className="space-y-6"><div><h2 className="text-xl font-bold text-slate-900">Users</h2><p className="mt-1 text-sm text-slate-500">Account directory and database-assigned roles. Account administration is read-only here.</p></div>
    {loading&&<p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading user directory…</p>}{error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading&&!error&&<Card title="Registered accounts" subtitle={`${users.length} profiles`}>
      {users.length?<Table maxHeight="600px" columns={[{key:"name",label:"Name"},{key:"email",label:"Email"},{key:"role",label:"Role"},{key:"created",label:"Created"}]} data={users.map(u=>({name:u.name||"—",email:maskEmail(u.email),role:<Badge color={u.role==="admin"?"blue":"slate"}>{u.role}</Badge>,created:new Date(u.created_at).toLocaleDateString()}))}/>:<p className="text-sm text-slate-600">No profiles found.</p>}
    </Card>}</div>;
}
