import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import * as store from '@/lib/store';
import { lessonSchema, reflectionSchema, type Lesson } from '@/lib/domain';
export const runtime='nodejs';
async function handle(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 try{
 const {path}=await params;const [resource,id,action]=path;const token=req.cookies.get('lessonlog-session')?.value||'';
 if(resource==='session'&&req.method==='POST') {if(process.env.APP_MODE==='production')return NextResponse.json({error:'Supabase 인증 구성이 필요합니다.'},{status:503});const session=store.createSession();const res=NextResponse.json({ok:true});res.cookies.set('lessonlog-session',session,{httpOnly:true,sameSite:'strict',secure:req.nextUrl.protocol==='https:',path:'/',maxAge:30*86400});return res;}
 const user=store.sessionUser(token);if(!user)return NextResponse.json({error:'로그인이 필요합니다.'},{status:401});
 if(req.method!=='GET'&&req.headers.get('origin')&&req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'허용되지 않은 요청입니다.'},{status:403});
 if(resource==='session'&&req.method==='DELETE'){store.endSession(token);const res=NextResponse.json({ok:true});res.cookies.delete('lessonlog-session');return res;}
 if(resource==='profile'){if(req.method==='GET')return NextResponse.json(store.profile(user)||null);const data=z.object({displayName:z.string().min(1).max(80),schoolLevel:z.string(),subject:z.string(),grade:z.string(),aiEnabled:z.boolean()}).parse(await req.json());return NextResponse.json(store.put(user,'profile',{id:`profile-${user}`,...data}));}
 if(resource==='lessons'){
 if(!id&&req.method==='GET')return NextResponse.json(store.lessons(user));
 if(!id&&req.method==='POST'){const data=lessonSchema.parse(await req.json());const lesson={...data,id:randomUUID(),groupId:randomUUID(),version:1};return NextResponse.json(store.put(user,'lesson',lesson));}
 const lesson=store.get<Lesson>(user,id);if(!lesson)return NextResponse.json({error:'기록을 찾을 수 없습니다.'},{status:404});
 if(action==='reflection'){if(req.method==='DELETE'){delete lesson.reflection;delete lesson.analysis;delete lesson.editedAnalysis;lesson.status='planned';}else{lesson.reflection=reflectionSchema.parse(await req.json());lesson.status='reflected';delete lesson.analysis;delete lesson.editedAnalysis;lesson.accepted=false;}return NextResponse.json(store.put(user,'lesson',lesson));}
 if(req.method==='GET')return NextResponse.json(lesson);
 if(req.method==='PUT')return NextResponse.json(store.put(user,'lesson',{...lesson,...lessonSchema.parse(await req.json())}));
 if(req.method==='DELETE'){store.remove(user,id);return NextResponse.json({ok:true});}
 }
 return NextResponse.json({error:'지원하지 않는 요청입니다.'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?e.issues[0].message:'요청을 처리하지 못했습니다. 다시 시도해 주세요.'},{status:400});}
}
export {handle as GET,handle as POST,handle as PUT,handle as DELETE};
