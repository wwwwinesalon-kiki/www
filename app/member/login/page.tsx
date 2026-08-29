import type {Metadata} from 'next';import Link from 'next/link';import MemberLoginForm from '@/components/member-login-form';
export const metadata:Metadata={title:'Member Login',robots:{index:false,follow:false}};
export default function Login(){return <main className="login-page"><Link href="/" className="brand"><span>WWW</span><small>WINE WORK WOMEN</small></Link><div className="login-box"><p className="eyebrow">MEMBERS ONLY</p><h1>おかえりなさい。</h1><p>会員限定の物語と、次の体験へ。</p><MemberLoginForm/><small>パスワードをお忘れの場合は運営へお問い合わせください。</small></div></main>}
