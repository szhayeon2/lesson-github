import { db, firebaseConfig } from './firebase';
import type { Lesson, Profile } from './domain';

export { db };
export * from 'firebase/firestore';

export interface FirestoreDocument<T = unknown> {
  id: string;
  userId: string;
  kind: string;
  data: T;
  updatedAt: string;
}

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

function toFirestoreValue(val: unknown): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreDoc<T>(doc: any): T {
  const res: any = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    res[k] = fromFirestoreValue(v);
  }
  return res as T;
}

/**
 * Firebase Firestore 연동 서비스 (REST API 기반 - Node.js/서버리스 환경 안정성 보장)
 */
export const firestoreService = {
  // --- 세션 관리 ---
  async saveSession(token: string, userId: string): Promise<void> {
    try {
      const url = `${BASE_URL}/sessions/${encodeURIComponent(token)}`;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: toFirestoreFields({
            token,
            userId,
            expires: Date.now() + 30 * 86400000,
            createdAt: new Date().toISOString()
          })
        }),
        cache: 'no-store'
      });
    } catch (err) {
      console.warn('[Firestore] 세션 저장 오류 (로컬 폴백 유지):', err);
    }
  },

  async getSessionUser(token: string): Promise<string | undefined> {
    try {
      const url = `${BASE_URL}/sessions/${encodeURIComponent(token)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return undefined;
      const data = await res.json();
      const doc = fromFirestoreDoc<{ userId: string; expires: number }>(data);
      if (doc && doc.userId && doc.expires > Date.now()) {
        return doc.userId;
      }
    } catch (err) {
      console.warn('[Firestore] 세션 조회 오류:', err);
    }
    return undefined;
  },

  async deleteSession(token: string): Promise<void> {
    try {
      const url = `${BASE_URL}/sessions/${encodeURIComponent(token)}`;
      await fetch(url, { method: 'DELETE', cache: 'no-store' });
    } catch (err) {
      console.warn('[Firestore] 세션 삭제 오류:', err);
    }
  },

  // --- 프로필 관리 ---
  async getProfile(userId: string): Promise<(Profile & { id: string }) | null> {
    try {
      const url = `${BASE_URL}/profiles/profile-${encodeURIComponent(userId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return fromFirestoreDoc<Profile & { id: string }>(data);
    } catch (err) {
      console.warn('[Firestore] 프로필 조회 오류:', err);
      return null;
    }
  },

  async saveProfile(userId: string, profile: Profile): Promise<Profile & { id: string }> {
    const docData: Profile & { id: string; userId: string; updatedAt: string } = {
      id: `profile-${userId}`,
      userId,
      ...profile,
      updatedAt: new Date().toISOString()
    };
    try {
      const url = `${BASE_URL}/profiles/profile-${encodeURIComponent(userId)}`;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(docData) }),
        cache: 'no-store'
      });
    } catch (err) {
      console.warn('[Firestore] 프로필 저장 오류:', err);
    }
    return docData;
  },

  // --- 수업 및 회고 관리 ---
  async getLessons(userId: string): Promise<Lesson[]> {
    try {
      // StructuredQuery 를 사용하여 특정 userId 의 수업 목록 조회
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`;
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'lessons' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'userId' },
                op: 'EQUAL',
                value: { stringValue: userId }
              }
            }
          }
        }),
        cache: 'no-store'
      });

      if (!res.ok) return [];
      const results = await res.json();
      const list: Lesson[] = [];
      for (const item of results) {
        if (item.document) {
          const lesson = fromFirestoreDoc<Lesson & { userId: string }>(item.document);
          const { userId: _, ...cleanLesson } = lesson;
          list.push(cleanLesson as Lesson);
        }
      }
      return list;
    } catch (err) {
      console.warn('[Firestore] 수업 목록 조회 오류:', err);
      return [];
    }
  },

  async getLesson(userId: string, lessonId: string): Promise<Lesson | null> {
    try {
      const url = `${BASE_URL}/lessons/${encodeURIComponent(lessonId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      const lesson = fromFirestoreDoc<Lesson & { userId: string }>(data);
      if (lesson.userId === userId) {
        const { userId: _, ...cleanLesson } = lesson;
        return cleanLesson as Lesson;
      }
    } catch (err) {
      console.warn('[Firestore] 수업 조회 오류:', err);
    }
    return null;
  },

  async saveLesson(userId: string, lesson: Lesson): Promise<Lesson> {
    try {
      const url = `${BASE_URL}/lessons/${encodeURIComponent(lesson.id)}`;
      const docData = {
        ...lesson,
        userId,
        updatedAt: new Date().toISOString()
      };
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(docData) }),
        cache: 'no-store'
      });
    } catch (err) {
      console.warn('[Firestore] 수업 저장 오류:', err);
    }
    return lesson;
  },

  async deleteLesson(userId: string, lessonId: string): Promise<void> {
    try {
      const url = `${BASE_URL}/lessons/${encodeURIComponent(lessonId)}`;
      await fetch(url, { method: 'DELETE', cache: 'no-store' });
    } catch (err) {
      console.warn('[Firestore] 수업 삭제 오류:', err);
    }
  }
};
