import { createClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'node:async_hooks';
export const authContext=new AsyncLocalStorage<string>();
export function remote(){if(process.env.APP_MODE!=='production')return null;const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error('Supabase 환경변수를 설정해 주세요.');return createClient(url,key,{global:{headers:{Authorization:`Bearer ${authContext.getStore()||''}`}},auth:{persistSession:false,autoRefreshToken:false}});}
