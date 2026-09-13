import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import type { Lesson, Profile } from './domain';
import { firestoreService } from './firestore';

export { firestoreService };
export { db } from './firebase';

const SESSION_SECRET = process.env.SESSION_SECRET || 'lessonlog-session-secret-salt-2026';

export function signToken(userId: string, expires: number = Date.now() + 30 * 86400000): string {
  const payload = `${userId}.${expires}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySignedToken(token: string): string | undefined {
  if (!token || typeof token !== 'string') return undefined;
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [userId, expStr, sig] = parts;
  const expires = Number(expStr);
  if (!userId || !expires || isNaN(expires) || expires <= Date.now()) return undefined;
  const expectedSig = createHmac('sha256', SESSION_SECRET).update(`${userId}.${expires}`).digest('base64url');
  if (sig.length !== expectedSig.length) return undefined;
  try {
    const match = timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    return match ? userId : undefined;
  } catch {
    return undefined;
  }
}

interface StoreAdapter {
  createSession(): string;
  sessionUser(token: string): string | undefined;
  endSession(token: string): void;
  list<T>(user: string, kind: string): T[];
  get<T>(user: string, id: string): T | undefined;
  put<T extends { id: string }>(user: string, kind: string, value: T): T;
  remove(user: string, id: string): void;
  clear(user: string): void;
}

class MemoryStore implements StoreAdapter {
  private sessions = new Map<string, { userId: string; expires: number }>();
  private docs = new Map<string, { userId: string; kind: string; body: string }>();

  createSession(): string {
    const userId = randomUUID();
    const token = signToken(userId);
    this.sessions.set(token, { userId, expires: Date.now() + 30 * 86400000 });
    void firestoreService.saveSession(token, userId);
    return token;
  }
  sessionUser(token: string): string | undefined {
    const s = this.sessions.get(token);
    if (s && s.expires > Date.now()) return s.userId;
    return undefined;
  }
  endSession(token: string): void {
    this.sessions.delete(token);
    void firestoreService.deleteSession(token);
  }
  list<T>(user: string, kind: string): T[] {
    const res: T[] = [];
    for (const d of this.docs.values()) {
      if (d.userId === user && d.kind === kind) res.push(JSON.parse(d.body));
    }
    return res;
  }
  get<T>(user: string, id: string): T | undefined {
    const d = this.docs.get(id);
    if (d && d.userId === user) return JSON.parse(d.body);
    return undefined;
  }
  put<T extends { id: string }>(user: string, kind: string, value: T): T {
    this.docs.set(value.id, { userId: user, kind, body: JSON.stringify(value) });
    return value;
  }
  remove(user: string, id: string): void {
    const d = this.docs.get(id);
    if (d && d.userId === user) {
      this.docs.delete(id);
    }
  }
  clear(user: string): void {
    for (const [k, d] of this.docs.entries()) {
      if (d.userId === user) this.docs.delete(k);
    }
  }
}

function initStore(): StoreAdapter {
  if (process.env.VERCEL) {
    return new MemoryStore();
  }
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { mkdirSync } = require('node:fs');
    mkdirSync('data', { recursive: true });
    const db = new DatabaseSync('data/lessonlog.sqlite');
    db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS owner_kind ON documents(user_id,kind); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);`);
    return {
      createSession: () => {
        const userId = randomUUID();
        const token = signToken(userId);
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token, userId, Date.now() + 30 * 86400000);
        void firestoreService.saveSession(token, userId);
        return token;
      },
      sessionUser: (token: string) => {
        return (db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(token, Date.now()) as { user_id: string } | undefined)?.user_id;
      },
      endSession: (token: string) => {
        db.prepare('DELETE FROM sessions WHERE token=?').run(token);
        void firestoreService.deleteSession(token);
      },
      list: <T>(user: string, kind: string): T[] => {
        return db.prepare('SELECT body FROM documents WHERE user_id=? AND kind=?').all(user, kind).map((r: any) => JSON.parse(r.body as string));
      },
      get: <T>(user: string, id: string): T | undefined => {
        const row = db.prepare('SELECT body FROM documents WHERE id=? AND user_id=?').get(id, user) as { body: string } | undefined;
        return row ? JSON.parse(row.body) : undefined;
      },
      put: <T extends { id: string }>(user: string, kind: string, value: T): T => {
        db.prepare('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body WHERE documents.user_id=excluded.user_id').run(value.id, user, kind, JSON.stringify(value));
        return value;
      },
      remove: (user: string, id: string) => {
        db.prepare('DELETE FROM documents WHERE id=? AND user_id=?').run(id, user);
      },
      clear: (user: string) => {
        db.prepare('DELETE FROM documents WHERE user_id=?').run(user);
      }
    };
  } catch {
    return new MemoryStore();
  }
}

const storeAdapter = initStore();

export function createSession(userId?: string) {
  const uid = userId || randomUUID();
  const token = signToken(uid);
  void firestoreService.saveSession(token, uid);
  return token;
}

export async function sessionUser(token: string): Promise<string | undefined> {
  if (!token) return undefined;

  // 1. 서명된 토큰 자체 검증 (0ms, 서버리스 인스턴스 무관)
  const signedUser = verifySignedToken(token);
  if (signedUser) return signedUser;

  // 2. 로컬 스토어 캐시 검증
  const localUser = storeAdapter.sessionUser(token);
  if (localUser) return localUser;

  // 3. Firestore 세션 컬렉션 조회 (기존 난수 토큰 호환성 보장)
  const firestoreUser = await firestoreService.getSessionUser(token);
  return firestoreUser;
}

export async function endSession(token: string) {
  storeAdapter.endSession(token);
  await firestoreService.deleteSession(token);
}

export async function list<T>(user: string, kind: string): Promise<T[]> {
  return storeAdapter.list<T>(user, kind);
}

export async function get<T>(user: string, id: string): Promise<T | undefined> {
  const local = storeAdapter.get<T>(user, id);
  if (local) return local;

  const fsLesson = await firestoreService.getLesson(user, id);
  if (fsLesson) {
    storeAdapter.put(user, 'lesson', fsLesson as any);
    return fsLesson as unknown as T;
  }
  return undefined;
}

export async function put<T extends { id: string }>(user: string, kind: string, value: T): Promise<T> {
  storeAdapter.put(user, kind, value);
  if (kind === 'lesson') {
    await firestoreService.saveLesson(user, value as unknown as Lesson);
  } else if (kind === 'profile') {
    await firestoreService.saveProfile(user, value as unknown as Profile);
  }
  return value;
}

export async function remove(user: string, id: string) {
  storeAdapter.remove(user, id);
  await firestoreService.deleteLesson(user, id);
}

export function clear(user: string) {
  storeAdapter.clear(user);
}

export function transaction<T>(fn: () => T) {
  try {
    return fn();
  } catch (e) {
    throw e;
  }
}

export async function seedDefaultData(user: string) {
  const existing = storeAdapter.list<Lesson>(user, 'lesson');
  if (existing.length > 0) return;

  // Firestore 에 이미 수업이 있는지 확인
  const fsLessons = await firestoreService.getLessons(user);
  if (fsLessons && fsLessons.length > 0) {
    for (const l of fsLessons) {
      storeAdapter.put(user, 'lesson', l);
    }
    return;
  }

  const samples: Lesson[] = [
    {
      id: randomUUID(),
      groupId: randomUUID(),
      version: 1,
      title: '수난이대 - 매체 활용 수업',
      lessonAt: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 16),
      subject: '국어',
      grade: '3',
      className: '3학년 2반',
      unit: '1. 문학과 만나는 시간',
      objective: '소설 속 인물의 갈등과 시대적 배경을 패들렛 및 디지털 매체를 활용해 다각도로 분석할 수 있다.',
      question: '전쟁의 상처를 부자는 어떻게 극복해 나가는가?',
      activities: '패들렛을 활용한 인물 관계도 작성, 모둠별 장면 분석 및 현대적 재해석 토론',
      difficulties: '모둠별 기기 배부 및 로그인 과정에서 시간 지체',
      observations: '소외되는 학생 없이 디지털 협업 도구에 참여하는지 관찰',
      tags: '문학, 현대소설, 매체활용, 패들렛',
      status: 'reflected',
      change: '',
      reason: '',
      reflection: {
        satisfaction: 4,
        wentWell: '패들렛을 활용한 인물 관계도 작성이 학생들의 흥미를 유발하는 데 매우 효과적이었음. 시각적으로 인물 간 갈등을 정리하니 이해도가 높아짐.',
        unexpected: '모둠별 기기 배부 및 로그인 과정에서 시간이 10분 이상 지체되어 본 활동 시간이 부족했음.',
        nextChange: '다음 차시에는 수업 전 미리 태블릿 로그인을 세팅해두거나, 모둠장에게 사전 교육을 실시해야겠음.',
        difficulties: '소설 속 방언과 역사적 배경지식이 부족한 학생들의 이해 지연.',
        note: '특정 학생이 소설 속 만도와 진수의 부자 관계에 깊이 공감하며 활발히 의견을 나누는 모습이 인상적이었음.',
        emotions: ['몰입', '공감', '아쉬움'],
        energy: 4
      }
    },
    {
      id: randomUUID(),
      groupId: randomUUID(),
      version: 1,
      title: '시의 운율과 비유적 표현 탐구',
      lessonAt: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 16),
      subject: '국어',
      grade: '2',
      className: '2학년 3반',
      unit: '1. 마음을 담은 노래',
      objective: '시에서 운율을 형성하는 요소와 비유적 표현의 효과를 이해하고 자신의 일상을 시로 표현할 수 있다.',
      question: '운율과 비유가 우리 마음에 어떤 울림을 주는가?',
      activities: '모둠별 시 낭송 릴레이, 일상 사물을 비유로 나타내는 3줄 시 쓰기, 서로의 시에 공감 댓글 남기기',
      difficulties: '은유와 직유를 구분하기 어려워하거나 첫 행을 쓰기 주저하는 학생이 있음',
      observations: '모둠 활동 시 소외되는 학생 없이 돌아가며 의견을 내는지 관찰',
      tags: '문학, 비유, 시 창작, 협동학습',
      status: 'reflected',
      change: '',
      reason: '',
      reflection: {
        satisfaction: 5,
        wentWell: '시 낭송 릴레이 활동에서 평소 발표를 주저하던 학생들도 부담 없이 한 줄씩 낭송에 적극적으로 참여함. 3줄 시 쓰기 결과물이 기대 이상으로 창의적이었음.',
        unexpected: '비유 표현을 만드는 단계에서 학생들의 질문이 많아 모둠 활동 시간이 예상보다 5분 정도 지연됨.',
        nextChange: '다음 수업에는 비유 표현 예시 카드 3종을 미리 칠판에 시각 자료로 부착해두고, 모둠별 활동 시간을 5분 더 확보해야겠다.',
        difficulties: '은유적 표현(A는 B이다)을 찾을 때 직관적 연결에 어려움을 겪음.',
        note: '"선생님, 비유를 쓰니까 제 마음이 더 뚜렷하게 보이는 것 같아요." (김OO 학생)',
        emotions: ['뿌듯함', '보람', '기대'],
        energy: 4
      }
    },
    {
      id: randomUUID(),
      groupId: randomUUID(),
      version: 1,
      title: '사실과 의견 구별하기 - 뉴스 기사 팩트체크',
      lessonAt: new Date(Date.now() - 86400000).toISOString().slice(0, 16),
      subject: '국어',
      grade: '2',
      className: '2학년 1반',
      unit: '2. 세상을 바라보는 눈',
      objective: '글에 드러난 사실과 의견을 구분하고, 타당한 근거를 바탕으로 글을 비판적으로 읽을 수 있다.',
      question: '우리가 접하는 뉴스 정보는 모두 객관적인 사실일까?',
      activities: '최신 뉴스 기사 3편을 읽고 사실(Fact) 문장 밑줄 긋기, 기자의 의견 문장 형광펜 칠하기, 모둠별 팩트체크 발표',
      difficulties: '수치나 통계가 들어간 문장을 무조건 사실로 오해하는 경향',
      observations: '통계의 출처와 해석의 차이를 발견하는지 점검',
      tags: '읽기, 비판적 사고, 미디어 리터러시',
      status: 'reflected',
      change: '',
      reason: '',
      reflection: {
        satisfaction: 4,
        wentWell: '실제 뉴스 기사를 다루니 학생들의 몰입도가 매우 높았고 사실과 의견을 구분하는 기준을 스스로 찾아냄.',
        unexpected: '광고성 기사(기사형 광고)를 다룰 때 사실과 주장의 경계가 모호하여 토론이 길어짐.',
        nextChange: '다음 차시에는 교과서 지문 대신 카드뉴스 형태의 자료를 활용해 비교 읽기를 심화해 볼 예정.',
        difficulties: '인터뷰 인용 문장이 사실인지 의견인지 혼동하는 학생이 있었음.',
        note: '"의견도 사실처럼 쓰일 수 있다는 걸 처음 알았어요."',
        emotions: ['흥미진진', '안도'],
        energy: 4
      }
    },
    {
      id: randomUUID(),
      groupId: randomUUID(),
      version: 1,
      title: '주장과 근거가 드러나는 설득하는 글쓰기',
      lessonAt: new Date().toISOString().slice(0, 16),
      subject: '국어',
      grade: '2',
      className: '2학년 2반',
      unit: '3. 생각을 나누는 시간',
      objective: '자신의 주장을 뒷받침할 수 있는 타당하고 신뢰할 수 있는 근거를 들어 논설문을 작성할 수 있다.',
      question: '상대방의 마음을 움직이는 설득의 힘은 어디에서 오는가?',
      activities: '설득 개요표 작성하기, 짝과 함께 근거의 타당성 상호 피드백하기, 초고 작성',
      difficulties: '자신의 주장에 반대되는 입장을 고려하지 못하는 점',
      observations: '피드백을 반영하여 근거를 보완하는지 관찰',
      tags: '쓰기, 논설문, 설득, 동료평가',
      status: 'planned',
      change: '',
      reason: ''
    }
  ];

  for (const l of samples) {
    await put(user, 'lesson', l);
  }
}

export async function profile(user: string) {
  const local = storeAdapter.get<Profile & { id: string }>(user, `profile-${user}`);
  if (local) return local;

  const fsProfile = await firestoreService.getProfile(user);
  if (fsProfile) {
    storeAdapter.put(user, 'profile', fsProfile);
    return fsProfile;
  }
  return undefined;
}

export async function lessons(user: string) {
  const fsLessons = await firestoreService.getLessons(user);
  if (fsLessons && fsLessons.length > 0) {
    for (const l of fsLessons) {
      storeAdapter.put(user, 'lesson', l);
    }
    return fsLessons;
  }

  const local = storeAdapter.list<Lesson>(user, 'lesson');
  if (local.length > 0) return local;

  await seedDefaultData(user);
  return storeAdapter.list<Lesson>(user, 'lesson');
}
