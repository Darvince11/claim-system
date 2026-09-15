import { FormEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../services/api';
import { Empty, ErrorNotice, formatDate, Loading, PageHeader, Pagination, useResource } from '../../components/ui';

interface AuditLog {id:string;actorName:string;action:string;entityType:string;entityId:string|null;roles:string[];metadata:unknown;createdAt:string;}

export function AuditLogs(){
  const [page,setPage]=useState(1);const [search,setSearch]=useState('');const [query,setQuery]=useState('');
  const result=useResource<{data:AuditLog[];meta:{total:number}}>(()=>api(`/audit-logs?page=${page}&pageSize=15&search=${encodeURIComponent(query)}`),[page,query]);
  function submit(event:FormEvent){event.preventDefault();setPage(1);setQuery(search);}
  return <><PageHeader title="Audit logs"/><form className="search-form list-toolbar" onSubmit={submit}><input aria-label="Search audit logs" placeholder="Action, actor, entity" value={search} onChange={event=>setSearch(event.target.value)}/><button className="button secondary" aria-label="Search" title="Search"><Search size={17}/></button></form><ErrorNotice message={result.error}/>{result.loading?<Loading/>:result.data?.data.length?<><div className="table-scroll"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Metadata</th></tr></thead><tbody>{result.data.data.map(log=><tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.actorName}<small>{log.roles.join(', ')||'No role snapshot'}</small></td><td>{log.action}</td><td>{log.entityType}<small>{log.entityId??'No entity id'}</small></td><td><code className="json-cell">{JSON.stringify(log.metadata)}</code></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={15} total={result.data.meta.total} onPage={setPage}/></>:!result.error&&<Empty title="No audit logs found" message="No audit events match this search."/>}</>;
}
