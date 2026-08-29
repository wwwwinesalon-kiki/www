const enc=new TextEncoder();
export async function sha256(value:string){const buf=await crypto.subtle.digest('SHA-256',enc.encode(value));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function hmac(value:string,secret:string){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,enc.encode(value));return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export async function createMemberSession(secret:string,version:string,lifetimeDays:number){const expires=Date.now()+lifetimeDays*86400000;const payload=`${version}.${expires}`;return `${payload}.${await hmac(payload,secret)}`}
export async function verifyMemberSession(token:string|undefined,secret:string,version:string){if(!token)return false;const [v,expires,sig]=token.split('.');if(v!==version||Number(expires)<Date.now())return false;return sig===await hmac(`${v}.${expires}`,secret)}
export type AdminRole='owner'|'editor'|'viewer';export function canWrite(role:AdminRole){return role==='owner'||role==='editor'}
