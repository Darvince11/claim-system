export function webOrigin(){return process.env.WEB_ORIGIN??(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined);}
