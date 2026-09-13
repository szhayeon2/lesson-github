import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
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

/**
 * Firebase Firestore 연동 서비스
 */
export const firestoreService = {
  // --- 세션 관리 ---
  async saveSession(token: string, userId: string): Promise<void> {
    try {
      const ref = doc(db, 'sessions', token);
      await setDoc(ref, {
        token,
        userId,
        expires: Date.now() + 30 * 86400000,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[Firestore] 세션 저장 오류 (로컬 폴백 유지):', err);
    }
  },

  async getSessionUser(token: string): Promise<string | undefined> {
    try {
      const ref = doc(db, 'sessions', token);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.expires > Date.now()) {
          return data.userId as string;
        }
      }
    } catch (err) {
      console.warn('[Firestore] 세션 조회 오류:', err);
    }
    return undefined;
  },

  async deleteSession(token: string): Promise<void> {
    try {
      const ref = doc(db, 'sessions', token);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('[Firestore] 세션 삭제 오류:', err);
    }
  },

  // --- 프로필 관리 ---
  async getProfile(userId: string): Promise<(Profile & { id: string }) | null> {
    try {
      const ref = doc(db, 'profiles', `profile-${userId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as Profile & { id: string };
      }
    } catch (err) {
      console.warn('[Firestore] 프로필 조회 오류:', err);
    }
    return null;
  },

  async saveProfile(userId: string, profile: Profile): Promise<Profile & { id: string }> {
    const docData: Profile & { id: string; userId: string; updatedAt: string } = {
      id: `profile-${userId}`,
      userId,
      ...profile,
      updatedAt: new Date().toISOString()
    };
    try {
      const ref = doc(db, 'profiles', `profile-${userId}`);
      await setDoc(ref, docData);
    } catch (err) {
      console.warn('[Firestore] 프로필 저장 오류:', err);
    }
    return docData;
  },

  // --- 수업 및 회고 관리 ---
  async getLessons(userId: string): Promise<Lesson[]> {
    try {
      const ref = collection(db, 'lessons');
      const q = query(ref, where('userId', '==', userId));
      const snap = await getDocs(q);
      const list: Lesson[] = [];
      snap.forEach((d) => {
        const item = d.data();
        const { userId: _, ...lesson } = item;
        list.push(lesson as Lesson);
      });
      return list;
    } catch (err) {
      console.warn('[Firestore] 수업 목록 조회 오류:', err);
      return [];
    }
  },

  async getLesson(userId: string, lessonId: string): Promise<Lesson | null> {
    try {
      const ref = doc(db, 'lessons', lessonId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const item = snap.data();
        if (item.userId === userId) {
          const { userId: _, ...lesson } = item;
          return lesson as Lesson;
        }
      }
    } catch (err) {
      console.warn('[Firestore] 수업 조회 오류:', err);
    }
    return null;
  },

  async saveLesson(userId: string, lesson: Lesson): Promise<Lesson> {
    try {
      const ref = doc(db, 'lessons', lesson.id);
      await setDoc(ref, {
        ...lesson,
        userId,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[Firestore] 수업 저장 오류:', err);
    }
    return lesson;
  },

  async deleteLesson(userId: string, lessonId: string): Promise<void> {
    try {
      const ref = doc(db, 'lessons', lessonId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn('[Firestore] 수업 삭제 오류:', err);
    }
  }
};
