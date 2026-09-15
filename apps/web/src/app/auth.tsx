import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, post, refreshSession, setAccessToken } from '../services/api';
export interface User {id:string;name:string;email:string;staffId:string;title:string;employmentType:string;category:string;departmentId:string|null;departmentName:string;facultyName:string;roles:string[];permissions:string[];scopes:{roleCode:string;departmentId:string}[];}
interface Auth {user:User|null;loading:boolean;login:(identifier:string,password:string)=>Promise<void>;logout:()=>Promise<void>;reload:()=>Promise<void>;}
const Context=createContext<Auth>(null!);
export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);
  const reload=async()=>{const result=await api('/auth/me');setUser(result.data);};
  useEffect(()=>{let active=true;const expired=()=>setUser(null);window.addEventListener('session-expired',expired);refreshSession().then(()=>api('/auth/me')).then(result=>{if(active)setUser(result.data);}).catch(()=>{if(active)setUser(null);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;window.removeEventListener('session-expired',expired);};},[]);
  const login=async(identifier:string,password:string)=>{const result=await post('/auth/login',{identifier,password});setAccessToken(result.data.accessToken);setUser(result.data.user);};
  const logout=async()=>{try{await post('/auth/logout');}finally{setAccessToken('');setUser(null);}};
  return <Context.Provider value={{user,loading,login,logout,reload}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
export const roleNames:Record<string,string>={LECTURER:'Lecturer',HOD:'Head of Department',PRO_VC:'Pro Vice-Chancellor',FINANCE:'Finance Officer',AUDITOR:'Auditor',ADMIN:'Administrator'};
export const rolePath:Record<string,string>={LECTURER:'lecturer',HOD:'hod',PRO_VC:'provc',FINANCE:'finance',AUDITOR:'audit',ADMIN:'admin'};
export const homeFor=(user:User)=>user.roles.some(role=>rolePath[role])?`/${rolePath[user.roles.find(role=>rolePath[role])!]}/dashboard`:'/profile';
