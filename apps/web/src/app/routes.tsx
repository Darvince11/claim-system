import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bell, Building2, ChevronDown, FileText, ClipboardCheck, LayoutDashboard, LogOut, Menu, SearchCheck, UserRound, Users, X, BarChart3, GraduationCap, Banknote } from 'lucide-react';
import { homeFor, roleNames, rolePath, useAuth } from './auth';
import { api } from '../services/api';
import { Loading, useResource } from '../components/ui';
import { Dashboard, Notifications, Profile } from '../features/workspace/Workspace';
import { UsersPage } from '../features/admin/Users';
import { ConfigurationPage } from '../features/admin/Configuration';
import { ClaimPolicy } from '../features/admin/ClaimPolicy';
import { ClaimDetail, ClaimEditor, ClaimList } from '../features/claims/Claims';
import { AuditLogs } from '../features/audit/AuditLogs';
import { AuditDashboard } from '../features/audit/AuditDashboard';
import { FinanceDashboard } from '../features/finance/FinanceDashboard';
import { ReportsPage } from '../features/reports/Reports';
import '../styles/workspace.css';
import '../styles/refined-ui.css';

function Protected(){const {user,loading}=useAuth();if(loading)return <Loading/>;return user?<Outlet/>:<Navigate to="/login" replace/>;}
function Home(){const {user}=useAuth();return <Navigate to={homeFor(user!)} replace/>;}
function RoleDashboard(){const {workspace}=useParams();const {user}=useAuth();if(!user!.roles.some(role=>rolePath[role]===workspace))return <Missing forbidden/>;if(workspace==='audit')return <AuditDashboard/>;if(workspace==='finance')return <FinanceDashboard/>;return <Dashboard/>;}
function Permission({permission,children}:{permission:string;children:React.ReactNode}){const {user}=useAuth();return user!.permissions.includes(permission)?children:<Missing forbidden/>;}
function ProfileAccess({children}:{children:React.ReactNode}){const {user}=useAuth();return user!.roles.some(role=>['ADMIN','PRO_VC'].includes(role))?children:<Missing forbidden/>;}
function Missing({forbidden=false}:{forbidden?:boolean}){return <section className="workspace-empty"><h1>{forbidden?'Access denied':'Page not found'}</h1><Link className="button secondary" to="/">Back to workspace</Link></section>;}
function NotificationButton(){
  const result=useResource<{data:{unread:number}}>(()=>api('/notifications/unread-count'),[]);
  useEffect(()=>{const reload=()=>result.reload();window.addEventListener('notifications-read',reload);return()=>window.removeEventListener('notifications-read',reload);},[result]);
  return <Link to="/notifications" className="icon-button notification-button" title="Notifications" aria-label="Notifications"><Bell size={19}/>{!!result.data?.data.unread&&<span className="notification-badge" aria-label={`${result.data.data.unread} unread notifications`}>{result.data.data.unread>9?'9+':result.data.data.unread}</span>}</Link>;
}
function Shell(){
  const {user,logout}=useAuth();const [open,setOpen]=useState(false);const [error,setError]=useState('');const location=useLocation();const navigate=useNavigate();const [activeRole,setActiveRole]=useState(user!.roles[0]);const [academicRecordsOpen,setAcademicRecordsOpen]=useState(location.pathname==='/admin/configuration');
  useEffect(()=>{const routeRole=user!.roles.find(role=>location.pathname.startsWith(`/${rolePath[role]}/`));if(routeRole)setActiveRole(routeRole);if(location.pathname==='/admin/configuration')setAcademicRecordsOpen(true);},[location.pathname,user]);
  const currentRole=user!.roles.includes(activeRole)?activeRole:user!.roles[0];
  const dashboard={to:`/${rolePath[currentRole]}/dashboard`,label:currentRole==='AUDITOR'?'Audit centre':currentRole==='FINANCE'?'Payment operations':'Overview',icon:LayoutDashboard};
  const activeAcademicSection=new URLSearchParams(location.search).get('section')??'faculties';const nav=[dashboard];
  if(currentRole==='LECTURER')nav.push({to:'/claims',label:'My claims',icon:FileText},{to:'/reports',label:'My reports',icon:BarChart3});
  if(currentRole==='HOD')nav.push({to:'/claims',label:'Department claims',icon:FileText},{to:'/reports',label:'Department reports',icon:BarChart3});
  if(currentRole==='PRO_VC')nav.push({to:'/claims',label:'VC review queue',icon:FileText},{to:'/reports',label:'Approval reports',icon:BarChart3},{to:'/profile',label:'My profile',icon:UserRound});
  if(currentRole==='AUDITOR')nav.push({to:'/claims?status=AUDIT_REVIEW',label:'Audit queue',icon:FileText},{to:'/reports',label:'Audit reports',icon:BarChart3},{to:'/audit/logs',label:'System audit logs',icon:SearchCheck});
  if(currentRole==='FINANCE')nav.push({to:'/claims?status=AUDIT_CLEARED',label:'Payment queue',icon:FileText},{to:'/reports',label:'Finance reports',icon:BarChart3});
  if(currentRole==='ADMIN'){
    nav.push({to:'/admin/users',label:'Staff accounts',icon:Users},{to:'/admin/configuration',label:'Academic records',icon:Building2},{to:'/admin/claim-policy',label:'Claim policy',icon:ClipboardCheck},{to:'/audit/logs',label:'System audit logs',icon:SearchCheck},{to:'/profile',label:'My profile',icon:UserRound});
  }
  nav.push({to:'/notifications',label:'Notifications',icon:Bell});
  return <div className="workspace"><a className="skip-link" href="#workspace-main">Skip to content</a>{open&&<button className="nav-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside className={`workspace-sidebar ${open?'is-open':''}`}><div className="workspace-brand"><Link to="/" onClick={()=>setOpen(false)}><img src="/images/upsa-logo.png" alt="UPSA"/></Link><button className="icon-button mobile-only" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={20}/></button></div><div className="workspace-product"><GraduationCap size={18}/><div><strong>Claims Portal</strong><span>Academic payments</span></div></div><span className="sidebar-caption">WORKSPACE</span>
    {user!.roles.length>1?<label className="role-picker">Workspace<select value={currentRole} onChange={event=>{setActiveRole(event.target.value);navigate(`/${rolePath[event.target.value]}/dashboard`);setOpen(false);}}>{user!.roles.map(role=><option key={role} value={role}>{roleNames[role]??role}</option>)}</select></label>:<div className="workspace-role">{roleNames[currentRole]??'Staff account'}</div>}
    <nav aria-label="Workspace">{nav.map(({to,label,icon:Icon})=>label==='Academic records'?<div className="nav-group" key={to}><button className={`nav-group-toggle ${location.pathname==='/admin/configuration'?'active':''}`} type="button" aria-expanded={academicRecordsOpen} onClick={()=>setAcademicRecordsOpen(value=>!value)}><Building2 size={18}/><span>Academic records</span><ChevronDown className={academicRecordsOpen?'is-open':''} size={16}/></button>{academicRecordsOpen&&<div className="nav-submenu">{[['faculties','Faculties'],['departments','Departments'],['courses','Courses'],['academic-years','Academic years'],['semesters','Semesters'],['workload-rules','Workload rules'],['lecturer-workloads','Teaching assignments'],['payment-rates','Payment rates']].map(([section,name])=><Link className={activeAcademicSection===section?'active':''} key={section} to={`/admin/configuration?section=${section}`} onClick={()=>setOpen(false)}>{name}</Link>)}</div>}</div>:<NavLink key={to} to={to} onClick={()=>setOpen(false)}><Icon size={18}/>{label}</NavLink>)}</nav><div className="sidebar-account"><span className="avatar">{user!.name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><div><strong>{user!.name}</strong><small>{user!.staffId}</small></div><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={async()=>{try{await logout();navigate('/login');}catch{setError('Signed out on this device.');}}}><LogOut size={18}/></button></div></aside>
    <div className="workspace-body"><header className="workspace-topbar"><button className="icon-button mobile-only" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={21}/></button><div className="topbar-context"><span>{user!.departmentName}</span><strong>{roleNames[currentRole]??currentRole}</strong></div><div className="topbar-actions"><NotificationButton/></div></header><main id="workspace-main" className="workspace-main">{error&&<p role="status">{error}</p>}<Outlet/></main><footer className="workspace-footer">University of Professional Studies, Accra</footer></div>
  </div>;
}
export function AppRoutes(){return <Routes><Route element={<Protected/>}><Route element={<Shell/>}><Route index element={<Home/>}/><Route path=":workspace/dashboard" element={<RoleDashboard/>}/><Route path="profile" element={<ProfileAccess><Profile/></ProfileAccess>}/><Route path="notifications" element={<Notifications/>}/><Route path="claims" element={<ClaimList/>}/><Route path="claims/new" element={<Permission permission="claims.create"><ClaimEditor/></Permission>}/><Route path="claims/:id/edit" element={<Permission permission="claims.edit_draft"><ClaimEditor/></Permission>}/><Route path="claims/:id" element={<ClaimDetail/>}/><Route path="reports" element={<ReportsPage/>}/><Route path="audit/logs" element={<Permission permission="audit.view"><AuditLogs/></Permission>}/><Route path="admin/users" element={<Permission permission="users.manage"><UsersPage/></Permission>}/><Route path="admin/configuration" element={<ConfigurationPage/>}/><Route path="admin/claim-policy" element={<Permission permission="settings.manage"><ClaimPolicy/></Permission>}/><Route path="forbidden" element={<Missing forbidden/>}/><Route path="*" element={<Missing/>}/></Route></Route></Routes>;}
