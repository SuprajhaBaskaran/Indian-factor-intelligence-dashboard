import { useEffect, useState } from "react";
import { Badge, Card, Table } from "@/components/UI";
import { supabase } from "@/lib/supabase";

type AuditEvent = { id:string; user_id:string|null; event_type:string; event_timestamp:string; metadata:Record<string,unknown>|null };

function safeAuditMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  const sensitiveKey = /(password|secret|token|api.?key|credential|authorization|cookie|email|phone|address)/i;
  const safeEntries = Object.entries(metadata).filter(([key]) => !sensitiveKey.test(key));
  if (safeEntries.length === 0) return "Sensitive details hidden";
  const safe = Object.fromEntries(safeEntries.map(([key, value]) => [
    key,
    typeof value === "string" ? value.replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, "[redacted token]").slice(0, 160) : value,
  ]));
  return JSON.stringify(safe).slice(0, 320);
}
export function AdminAuditPage() {
  const [events,setEvents] = useState<AuditEvent[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  useEffect(()=>{
    let cancelled=false;
    supabase!.from("audit_events").select("id,user_id,event_type,event_timestamp,metadata").order("event_timestamp",{ascending:false}).limit(200).then(({data,error:queryError})=>{
      if(cancelled)return;
      if(queryError)setError("Audit events are unavailable. Check admin access and database policies.");
      else setEvents((data||[]) as AuditEvent[]);
      setLoading(false);
    });
    return()=>{cancelled=true;};
  },[]);
  return <div className="space-y-6"><div><h2 className="text-xl font-bold text-slate-900">Audit</h2><p className="mt-1 text-sm text-slate-500">Recent account and system events. Secrets and authentication tokens are not shown.</p></div>
      {loading&&<p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading audit events…</p>}{error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading&&!error&&<Card title="Recent activity" subtitle={`Up to ${events.length} stored events`}>
      {events.length?<Table maxHeight="600px" columns={[{key:"time",label:"Time"},{key:"user",label:"User"},{key:"event",label:"Event"},{key:"details",label:"Safe metadata"}]} data={events.map(e=>({time:new Date(e.event_timestamp).toLocaleString(),user:e.user_id?<span className="font-mono text-xs">{e.user_id.slice(0,8)}…</span>:"System",event:<Badge color="blue">{e.event_type}</Badge>,details:safeAuditMetadata(e.metadata)}))}/>:<p className="text-sm text-slate-600">No audit events are currently stored.</p>}
    </Card>}</div>;
}
