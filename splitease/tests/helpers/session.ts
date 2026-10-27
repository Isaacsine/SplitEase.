import type { Page } from "@playwright/test";
export async function signedInTestAccount(page: Page) {
 const user={id:"11111111-1111-4111-8111-111111111111",aud:"authenticated",role:"authenticated",email:"payer@example.test",app_metadata:{provider:"email"},user_metadata:{},created_at:new Date().toISOString()};
 const jwt=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,aud:"authenticated",role:"authenticated",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")+".test";
 await page.addInitScript(session=>localStorage.setItem("sb-splitease-tests-auth-token",JSON.stringify(session)),{access_token:jwt,refresh_token:"test-refresh",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:"bearer",user});
}
