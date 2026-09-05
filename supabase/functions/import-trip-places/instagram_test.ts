import { instagramCaption, instagramPostUrl, readInstagramPost } from './instagram.ts';
function assert(value: unknown, message='Assertion failed'): asserts value { if (!value) throw new Error(message); }
const url='https://www.instagram.com/p/DVoO9caFVEV/';
const metadata = `<meta property="og:url" content="https://www.instagram.com/danielisetravel/p/DVoO9caFVEV/"><meta property="og:description" content="123 likes - author: &quot;Visit Meiji Jingu &#128205; and Tokyo &amp; Kyoto&quot;.">`;
Deno.test('Instagram normalizes posts, reels and username permalinks',()=>{
  assert(instagramPostUrl(url+'?igsh=test')===url);
  assert(instagramPostUrl('https://instagram.com/author/reel/abc_123/')==='https://www.instagram.com/reel/abc_123/');
  for(const value of ['https://instagram.com/author/','https://instagram.com/accounts/login/','https://instagram.com.evil.test/p/123/','https://user:pass@instagram.com/p/123/']) assert(instagramPostUrl(value)===null);
});
Deno.test('Instagram reads only caption metadata, decodes entities and ignores scripts',()=>{
  assert(instagramCaption(metadata,url)==='Visit Meiji Jingu 📍 and Tokyo & Kyoto');
  assert(instagramCaption(`<script>${metadata}</script>`,url)==='');
  assert(instagramCaption(metadata,'https://www.instagram.com/p/different/')==='');
  assert(instagramCaption('<meta name="description" content="Log in to Instagram">',url)==='');
});
Deno.test('Instagram fetches public HTML without executing it',async()=>{
  const caption=await readInstagramPost(url,((_url,init)=>{
    assert(init?.redirect==='manual');
    return Promise.resolve(new Response(metadata,{headers:{'content-type':'text/html'}}));
  }) as typeof fetch);
  assert(caption.includes('Meiji Jingu'));
});
Deno.test('Instagram refuses private, external redirects and oversized responses',async()=>{
  for(const location of ['https://127.0.0.1/private','https://www.instagram.com/accounts/login/','https://www.instagram.com/p/other/']) {
    let calls=0;
    assert(await readInstagramPost(url,(()=>{calls++;return Promise.resolve(new Response(null,{status:302,headers:{location}}));}) as typeof fetch)==='');
    assert(calls===1);
  }
  assert(await readInstagramPost(url,(()=>Promise.resolve(new Response('x'.repeat(2_000_001),{headers:{'content-type':'text/html'}}))) as typeof fetch)==='');
  assert(await readInstagramPost(url,(()=>Promise.resolve(new Response('',{status:403}))) as typeof fetch)==='');
});
