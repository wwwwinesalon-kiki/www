'use client';
import { useState } from 'react';
import Link from 'next/link';

type Course = {id:number;name:string;billingType:string};
export default function KaihipayControl() {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [courses,setCourses]=useState<Course[]>([]);
  async function run(path:string) {
    setBusy(true);setMessage('確認中です');
    try {
      const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store'});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error || '実行できませんでした');
      if (Array.isArray(data.courses)) {
        setCourses(data.courses);
        setMessage('コース一覧を取得しました');
      } else {
        setMessage(`確認対象 ${data.scanned}件 更新 ${data.updated}件 要確認 ${data.review}件`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '実行できませんでした');
    } finally {setBusy(false);}
  }
  return <main style={{maxWidth:720,margin:'5rem auto',padding:'0 1.5rem'}}>
    <p><Link href="/admin">管理画面へ戻る</Link></p>
    <h1>会費ペイ連携</h1>
    <p>入金済みの月額会費を照合し 会員の招待と閲覧期限を更新します</p>
    <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
      <button type="button" disabled={busy} onClick={()=>void run('/api/admin/kaihipay/check')}>
        接続とコースを確認
      </button>
      <button type="button" disabled={busy} onClick={()=>void run('/api/admin/kaihipay/sync')}>
        入金同期を実行
      </button>
    </div>
    <output style={{display:'block',marginTop:'1.5rem'}}>{message}</output>
    {courses.length>0 && <ul>{courses.map(c=><li key={c.id}>{c.name} / {c.billingType} / ID {c.id}</li>)}</ul>}
  </main>;
}
