export class ApiError extends Error {constructor(message:string,public status:number,public fieldErrors?:{fieldErrors?:Record<string,string[]>}){super(message);}}
let accessToken='';
let refreshing:Promise<void>|null=null;
export function setAccessToken(token:string){accessToken=token;}
async function responseBody(response:Response){
  const text=await response.text();
  if(!text.trim())throw new ApiError(`The server returned an empty response (${response.status}). Check the Vercel API deployment and environment variables.`,response.status);
  try{return JSON.parse(text);}catch{throw new ApiError(`The server returned an invalid response (${response.status}). Check the Vercel API deployment and environment variables.`,response.status);}
}
export async function refreshSession(){
  if(!refreshing) refreshing=fetch('/api/v1/auth/refresh',{method:'POST',credentials:'include'}).then(async response=>{if(!response.ok)throw new ApiError('Please sign in to continue.',401);const result=await responseBody(response);accessToken=result.data.accessToken;}).catch(error=>{accessToken='';window.dispatchEvent(new Event('session-expired'));throw error;}).finally(()=>{refreshing=null;});
  return refreshing;
}
export async function api<T=any>(path:string,options:RequestInit={},retry=true):Promise<T> {
  const response=await fetch(`/api/v1${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`} : {}),...options.headers}});
  if(response.status===401&&retry&&!path.startsWith('/auth/')){await refreshSession();return api(path,options,false);}
  if(response.status===204)return undefined as T;
  const body=await responseBody(response);if(!response.ok){const fields=body.error?.fieldErrors?.fieldErrors as Record<string,string[]>|undefined;const details=fields?Object.entries(fields).map(([field,errors])=>`${field}: ${errors.join(' ')}`).join(' '):'';throw new ApiError(details|| (typeof body.error?.message==='string'?body.error.message:'Please check your information and try again.'),response.status,body.error?.fieldErrors);}return body;
}
export const post=(path:string,data:unknown={},key:string=crypto.randomUUID())=>api(path,{method:'POST',body:JSON.stringify(data),headers:{'Idempotency-Key':key}});
export const patch=(path:string,data:unknown)=>api(path,{method:'PATCH',body:JSON.stringify(data)});
export async function downloadReport(type:string,format:string,query:string){
  const response=await fetch(`/api/v1/reports/${type}/export?${query}&format=${format}`,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!response.ok){const result=await responseBody(response);throw new Error(result.error?.message??'The export could not be downloaded.');}
  const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`upsa-${type}-report.${format}`;link.click();URL.revokeObjectURL(url);
}
