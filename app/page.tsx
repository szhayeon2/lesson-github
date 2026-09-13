'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { BookOpen, House, Sprout, FolderOpen, Settings, Plus, ArrowUpRight, ArrowLeft, Check, Search, Sparkles, LogOut, ChevronRight } from 'lucide-react';
import { api } from '@/lib/client';
import { lessonSchema, type Lesson, type Profile, type Reflection } from '@/lib/domain';
const tabs=[['home','홈',House],['lessons','수업 기록',BookOpen],['growth','성장',Sprout],['artifacts','자료함',FolderOpen],['settings','설정',Settings]] as const;
const blank=()=>({...lessonSchema.parse({title:'새 수업',lessonAt:new Date().toISOString().slice(0,16)}),title:''});
export default function App(){
 const [ready,setReady]=useState(false),[logged,setLogged]=useState(false),[profile,setProfile]=useState<Profile|null>(null),[lessons,setLessons]=useState<Lesson[]>([]),[tab,setTab]=useState('home'),[selected,setSelected]=useState<Lesson|null>(null),[editing,setEditing]=useState(false),[quick,setQuick]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[selectingLesson,setSelectingLesson]=useState(false);
 const refresh=useCallback(async()=>{const p=await api<Profile|null>('profile');setProfile(p);setLogged(true);setLessons(await api<Lesson[]>('lessons'));},[]);
 useEffect(()=>{void Promise.resolve().then(refresh).catch(()=>setLogged(false)).finally(()=>setReady(true));},[refresh]);
 async function run(fn:()=>Promise<void>){setError('');try{await fn();}catch(e){setError((e as Error).message);}}
 function navigate(value:string){setTab(value);setSelected(null);setEditing(false);setQuick(false);setSelectingLesson(false);}
 function create(isQuick=false){setSelected(null);setEditing(true);setQuick(isQuick);setTab('lessons');setSelectingLesson(false);}
 function handleQuickReflection(){
  const unreflected=lessons.filter(l=>!l.reflection);
  if(unreflected.length>0){setSelectingLesson(true);}
  else{create(true);}
 }
 async function saved(l:Lesson){setSelected(l);setEditing(false);await refresh();}
 if(!ready)return <main className="welcome">기록장을 불러오고 있어요…</main>;
 if(!logged)return <main className="welcome"><div className="brand"><BookOpen/> 수업로그<span>LessonLog</span></div><p className="eyebrow">나의 수업 성장 아카이브</p><h1>수업에도<br/><em>버전이 필요합니다.</em></h1><p>오늘의 작은 관찰이 다음 수업의 변화를 만듭니다.<br/>설계부터 회고까지, 나만의 수업 연구노트를 시작하세요.</p><button onClick={()=>run(async()=>{await api('session','POST');await refresh();})}>데모 기록장 시작하기 <ArrowUpRight size={18}/></button><small>이 브라우저의 비공개 데모 세션 · 실제 학생 정보는 입력하지 마세요.<br/>로그아웃하면 데모 세션에 다시 로그인할 수 없습니다. 먼저 내보내기를 이용하세요.</small>{error&&<p role="alert">{error}</p>}</main>;
 if(!profile)return <main className="welcome"><p className="eyebrow">처음 오셨군요</p><h1>선생님의 기록장을<br/>준비할게요.</h1><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(async()=>{await api('profile','PUT',{displayName:f.get('name'),schoolLevel:f.get('school'),subject:f.get('subject'),grade:f.get('grade'),aiEnabled:true});await refresh();});}}><label>표시 이름<input name="name" required placeholder="예: 기록하는 선생님"/></label><label>학교급<select name="school"><option>중학교</option><option>초등학교</option><option>고등학교</option></select></label><div className="columns"><label>담당 교과<input name="subject" defaultValue="국어" required/></label><label>담당 학년<select name="grade">{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label></div><p className="notice">학생 실명·연락처·성적을 기록하지 마세요. 모든 기록은 기본 비공개입니다.</p><button>내 기록장 열기 <ChevronRight size={18}/></button></form>{error&&<p role="alert">{error}</p>}</main>;
 return <div className="shell"><aside><Link className="brand" href="/"><BookOpen/> 수업로그<span>LessonLog</span></Link><p className="sidebar-caption">조금씩 달라지는 나의 수업</p><nav>{tabs.map(([id,label,Icon])=><button className={tab===id?'active':''} key={id} onClick={()=>navigate(id)}><Icon size={20}/>{label}{id==='lessons'&&<span className="count">{lessons.length}</span>}</button>)}</nav><div className="sidebar-note"><Sprout size={25}/><b>작은 기록, 오래가는 변화</b><p>완벽한 수업이 아니어도 괜찮아요.<br/>오늘 발견한 한 가지면 충분해요.</p></div><div className="account"><span className="avatar">{profile.displayName[0]}</span><div><b>{profile.displayName}</b><small>{profile.schoolLevel} · {profile.subject}</small></div><button className="icon" aria-label="로그아웃" onClick={()=>run(async()=>{await api('session','DELETE');sessionStorage.clear();setLogged(false);})}><LogOut size={17}/></button></div></aside><div className="workspace"><header><span>나의 수업 연구노트 <span className="muted">/ {tabs.find(t=>t[0]===tab)?.[1]}</span></span><span className="private"><span/> 비공개 기록장 · 데모</span></header><main><div className="page-top"><div><p className="eyebrow">{new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})}</p><h1>{editing?(quick?'수업 후 1분 회고':'수업 전 기록'):selected?selected.title:tab==='home'?`${profile.displayName}의 수업 노트`:tabs.find(t=>t[0]===tab)?.[1]}</h1></div><button onClick={()=>create()}><Plus size={18}/> 수업 기록</button></div>{error&&<div className="error" role="alert">{error}<button className="text-button" onClick={()=>setError('')}>닫기</button></div>}
 {selectingLesson&&<div className="modal-overlay" onClick={()=>setSelectingLesson(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>어떤 수업의 회고를 남길까요?</h2><p className="modal-subtitle">회고를 기다리는 수업이 있습니다. 선택하거나 새로 시작하세요.</p><div className="modal-list">{lessons.filter(l=>!l.reflection).map(l=><button key={l.id} className="modal-item" onClick={()=>{setSelected(l);setQuick(true);setEditing(true);setSelectingLesson(false);}}><b>{l.title}</b><small>{l.subject} · {l.grade}학년 {l.className?`(${l.className})`:''} · {l.lessonAt.slice(0,10)}</small></button>)}</div><div className="modal-actions"><button type="button" className="text-button" onClick={()=>setSelectingLesson(false)}>닫기</button><button type="button" onClick={()=>create(true)}>새 수업으로 바로 회고 쓰기 <ChevronRight size={16}/></button></div></div></div>}
 {editing?<Editor key={(selected?.id||'new')+(quick?'-quick':'-plan')} lesson={selected} profile={profile} quick={quick} onSave={saved} onError={setError} onCancel={()=>setEditing(false)}/>:selected?<Detail lesson={selected} onEdit={()=>setEditing(true)} onReflect={()=>{setQuick(true);setEditing(true);}} onBack={()=>setSelected(null)} onDelete={()=>run(async()=>{if(confirm('이 수업과 연결된 회고를 영구 삭제할까요?')){await api(`lessons/${selected.id}`,'DELETE');setSelected(null);await refresh();}})}/>:<>
 {tab==='home'&&<><section className="hero"><div><span className="pill">오늘의 작은 발견</span><h2>오늘의 수업에서 사라지기 전에<br/>남길 한 가지는 무엇인가요?</h2><p>잘된 순간도, 아쉬운 시도도 다음 수업의 좋은 출발점이 됩니다.</p><button onClick={()=>handleQuickReflection()}>1분 회고 남기기 <ArrowUpRight size={19}/></button><button className="text-button" onClick={()=>create()}>수업 전 기록하기 <ChevronRight size={16}/></button></div><div className="notebook" aria-hidden="true"><div className="paper"><span>MY LESSON NOTES</span><BookOpen size={36}/><b>수업에도<br/>버전이 필요합니다.</b><i/><i/><i/><span className="paper-tag">오늘보다 한 걸음 🌱</span></div></div></section><div className="stats"><div><span>쌓아온 수업</span><strong>{lessons.length}<small>개</small></strong><p>하나씩 쌓이는 나의 경험</p></div><div><span>돌아본 수업</span><strong>{lessons.filter(l=>l.reflection).length}<small>개</small></strong><p>관찰이 배움으로 바뀐 순간</p></div><div><span>새롭게 시도한 버전</span><strong>{lessons.filter(l=>l.version>1).length}<small>개</small></strong><p>지난 경험에서 한 걸음 더</p></div></div></>}
 {(tab==='home'||tab==='lessons')&&<section><div className="section-heading"><h2>{tab==='home'?'최근 수업 기록':'나의 기록 모아보기'}</h2>{tab==='home'&&<button className="text-button" onClick={()=>navigate('lessons')}>전체 보기 <ArrowUpRight size={16}/></button>}</div>{tab==='lessons'&&<label className="search"><Search size={19}/><input aria-label="기록 검색" placeholder="제목, 단원, 회고 속 한마디를 찾아보세요" value={query} onChange={e=>setQuery(e.target.value)}/></label>}<div className="lesson-grid">{lessons.filter(l=>JSON.stringify(l).includes(query)).slice(0,tab==='home'?6:undefined).map(l=><button className="lesson-card" key={l.id} onClick={()=>setSelected(l)}><div className="card-top"><span className={'badge '+(l.reflection?'green':'')}>{l.reflection?'회고 완료':'작성 중'}</span><span className="muted">v{l.version}</span></div><small>{l.subject} · {l.grade}학년 · {l.className||'학급 미지정'}</small><h3>{l.title}</h3><p>{l.reflection?.nextChange||l.objective||'작은 관찰을 이어서 기록해 보세요.'}</p><footer><span>{l.lessonAt.slice(0,10)} · {l.unit||'단원 미지정'}</span><ArrowUpRight size={17}/></footer></button>)}</div>{!lessons.filter(l=>JSON.stringify(l).includes(query)).length&&<div className="empty"><BookOpen size={30}/><h3>{query?'검색 결과가 없어요':'아직 비교할 기록이 없어요.'}</h3><p>첫 수업의 작은 관찰부터 남겨 보세요.</p><button className="secondary" onClick={()=>query?setQuery(''):create()}>{query?'검색 초기화':'첫 수업 기록하기'}</button></div>}</section>}
 {tab==='growth'&&<section className="panel"><Sprout/><h2>잘한 수업의 수가 아니라,<br/>달라진 지점을 보여드려요.</h2><p>패턴을 찾으려면 {Math.max(0,5-lessons.filter(l=>l.reflection).length)}개의 회고가 더 필요해요.</p></section>}
 {tab==='artifacts'&&<div className="empty"><FolderOpen/><h2>학생의 생각이 담긴 순간</h2><p>수업 기록에 연결한 비공개 산출물을 이곳에서 모아봅니다.</p></div>}
 {tab==='settings'&&<section className="panel"><h2>나의 기록장 설정</h2><p>{profile.displayName} · {profile.schoolLevel} · {profile.subject}</p><label className="check"><input type="checkbox" checked={profile.aiEnabled} onChange={e=>run(async()=>{await api('profile','PUT',{...profile,aiEnabled:e.target.checked});await refresh();})}/>AI 분석 사용 (mock 데모)</label><p className="notice">학생 실명과 개인정보는 입력하지 마세요. 외부 AI 서비스로 데이터가 전송되지 않는 데모 모드입니다.</p></section>}
 </>}<div className="bottom-note"><Sprout size={14}/> 기록은 평가가 아니라, 다음 수업을 위한 발견입니다.</div></main></div></div>;
}
function Editor({lesson,profile,quick,onSave,onError,onCancel}:{lesson:Lesson|null;profile:Profile;quick:boolean;onSave:(l:Lesson)=>Promise<void>;onError:(s:string)=>void;onCancel:()=>void}){
 const isNew=!lesson?.id;
 const defaultTitle=isNew&&quick?`${profile.subject} 수업 회고 (${new Date().toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})})`:'';
 const [draft,setDraft]=useState(()=>({...blank(),subject:profile.subject,grade:profile.grade,...lesson,...(isNew&&quick&&!lesson?.title?{title:defaultTitle}:{})}));
 const [reflection,setReflection]=useState<Reflection>(lesson?.reflection||{satisfaction:4,wentWell:'',unexpected:'',difficulties:'',nextChange:'',note:'',emotions:[],energy:4});
 const [saving,setSaving]=useState(false),[status,setStatus]=useState(''),[id,setId]=useState<string|undefined>(lesson?.id);
 const key=isNew?(quick?'lessonlog-draft-new-quick':'lessonlog-draft-new-lesson'):`lessonlog-draft-${lesson.id}`;

 useEffect(()=>{
  const timer=setTimeout(()=>{
   const cached=sessionStorage.getItem(key);
   if(cached){
    try{
     const data=JSON.parse(cached);
     if(data.draft)setDraft(prev=>({...prev,...data.draft}));
     if(data.reflection)setReflection(prev=>({...prev,...data.reflection}));
     if(!isNew&&data.id)setId(data.id);
    }catch{}
   }
  },0);
  return()=>clearTimeout(timer);
 },[key,isNew]);

 useEffect(()=>{
  const timer=setTimeout(()=>{
   sessionStorage.setItem(key,JSON.stringify({draft,reflection,id:isNew?undefined:id}));
   setStatus('이 브라우저에 초안 저장됨');
  },500);
  return()=>clearTimeout(timer);
 },[draft,reflection,id,key,isNew]);

 function resetDraft(){
  if(confirm('작성 중인 내용을 지우고 깨끗한 새 양식으로 작성할까요?')){
   sessionStorage.removeItem(key);
   sessionStorage.removeItem('lessonlog-draft-new');
   sessionStorage.removeItem('lessonlog-draft-new-quick');
   sessionStorage.removeItem('lessonlog-draft-new-lesson');
   const cleanTitle=isNew&&quick?defaultTitle:'';
   setDraft({...blank(),subject:profile.subject,grade:profile.grade,...lesson,title:cleanTitle});
   setReflection(lesson?.reflection||{satisfaction:4,wentWell:'',unexpected:'',difficulties:'',nextChange:'',note:'',emotions:[],energy:4});
   if(isNew)setId(undefined);
   setStatus('초안이 초기화되었습니다');
  }
 }

 function fillSample(){
  setReflection({
   satisfaction:4,
   wentWell:'패들렛을 활용한 인물 관계도 작성이 학생들의 흥미를 유발하는 데 매우 효과적이었음. 시각적으로 인물 간 갈등을 정리하니 이해도가 높아짐.',
   unexpected:'모둠별 기기 배부 및 로그인 과정에서 시간이 10분 이상 지체되어 본 활동 시간이 부족했음.',
   nextChange:'다음 차시에는 수업 전 미리 태블릿 로그인을 세팅해두거나, 모둠장에게 사전 교육을 실시해야겠음.',
   note:'특정 학생이 소설 속 인물의 상황에 깊이 공감하며 활발히 의견을 나누는 모습이 인상적이었음.',
   difficulties:'기기 조작 미숙으로 인물 카드 작성이 늦어진 학생 지도 필요',
   emotions:['몰입','공감','아쉬움'],
   energy:4
  });
  if(isNew&&!draft.title)setDraft(prev=>({...prev,title:'수난이대 - 매체 활용 수업'}));
  setStatus('예시 회고 내용이 입력되었습니다');
 }

 async function save(){
  if(saving)return;
  setSaving(true);
  onError('');
  try{
   const titleToSave=draft.title.trim()||(quick?defaultTitle||'수업 회고':'새 수업');
   const draftPayload={...draft,title:titleToSave};
   let result=await api<Lesson>(id?`lessons/${id}`:'lessons',id?'PUT':'POST',draftPayload);
   setId(result.id);
   if(quick)result=await api<Lesson>(`lessons/${result.id}/reflection`,'PUT',reflection);
   sessionStorage.removeItem(key);
   if(isNew){
    sessionStorage.removeItem('lessonlog-draft-new');
    sessionStorage.removeItem('lessonlog-draft-new-quick');
    sessionStorage.removeItem('lessonlog-draft-new-lesson');
   }
   await onSave(result);
  }catch(e){
   onError((e as Error).message);
  }finally{
   setSaving(false);
  }
 }

 const field=(name:keyof typeof draft,label:string,multi=false)=> <label key={name}>{label}{multi?<textarea value={String(draft[name]??'')} onChange={e=>setDraft({...draft,[name]:e.target.value})}/>:<input required={name==='title'} type={name==='lessonAt'?'datetime-local':'text'} value={String(draft[name]??'')} onChange={e=>setDraft({...draft,[name]:e.target.value})}/>}</label>;
 return <form className="panel editor" onSubmit={e=>{e.preventDefault();save();}}><div className="section-heading"><div style={{display:'flex',gap:'8px',alignItems:'center'}}><button type="button" className="text-button" onClick={onCancel}><ArrowLeft size={16}/> 돌아가기</button>{quick