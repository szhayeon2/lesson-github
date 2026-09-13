import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'수업깃허브 — 수업에도 버전이 필요합니다',description:'설계하고, 돌아보고, 조금씩 달라지는 나의 수업 기록 - 수업깃허브'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
