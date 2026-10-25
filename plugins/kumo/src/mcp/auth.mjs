import {timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';

export function tokenAuth(token){
  if(typeof token!=='string'||token.length<32)throw new Error('本地 HTTP 测试需要至少32字符的访问密钥');
  const expected=Buffer.from(token);
  return async header=>{const supplied=Buffer.from(String(header||'').replace(/^Bearer /,''));if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new Error('未授权');return {canWrite:true};};
}
export function oauthAuth({issuer,resource,subject,jwksUri},key){
  for(const value of [issuer,resource,jwksUri]){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)throw new Error('OAuth 地址必须为无凭据 HTTPS URL');}
  if(!subject)throw new Error('必须指定允许访问此库的 OAuth 用户 subject');
  const jwks=key||createRemoteJWKSet(new URL(jwksUri),{timeoutDuration:5000});
  return async header=>{if(!/^Bearer [^ ]{1,16000}$/.test(header||''))throw new Error('未授权');const {payload}=await jwtVerify(header.slice(7),jwks,{issuer,audience:resource,algorithms:['RS256','ES256'],requiredClaims:['exp','sub'],clockTolerance:5});if(payload.sub!==subject)throw new Error('不属于当前库用户');const scopes=String(payload.scope||'').split(' ');if(!scopes.includes('kumo:read'))throw new Error('缺少读取权限');return {canWrite:scopes.includes('kumo:organize')};};
}
