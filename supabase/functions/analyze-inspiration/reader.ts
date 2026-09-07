import { readPublicPost } from '../import-trip-places/providers.ts';
import { inspirationUrl } from '../../../packages/contracts/src/inspiration.ts';

// Unknown social networks can be saved but are never fetched by the server.
const metadataHosts = new Set(['youtube.com','www.youtube.com','youtu.be','facebook.com','www.facebook.com','m.facebook.com','x.com','www.x.com','twitter.com','www.twitter.com','threads.net','www.threads.net','threads.com','www.threads.com','pinterest.com','www.pinterest.com','pin.it','reddit.com','www.reddit.com','linkedin.com','www.linkedin.com']);
export async function readInspiration(url: string, fetcher = fetch): Promise<string> {
  const parsed = new URL(inspirationUrl(url));
  if (['instagram.com','www.instagram.com','tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(parsed.hostname)) return readPublicPost(url,fetcher);
  if (!metadataHosts.has(parsed.hostname)) return '';
  // Do not follow redirects to login pages, arbitrary hosts, or private networks.
  const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel(); return ''; }
  const reader=response.body?.getReader(); if(!reader)return '';
  const decoder=new TextDecoder(); let html=''; let size=0;
  try { while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>500000)break;html+=decoder.decode(next.value,{stream:true});} } finally {await reader.cancel();}
  return publicMetadata(html);
}
export function publicMetadata(html:string) {
  const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<!--[\s\S]*?-->/gi,'');
  const values:string[]=[];
  for(const tag of clean.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const attrs=new Map<string,string>();
    for(const a of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs.set(a[1].toLowerCase(),a[2]??a[3]);
    if(['og:title','og:description','twitter:description'].includes(attrs.get('property')??attrs.get('name')??'')) {
      const content=attrs.get('content')?.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').trim();
      if(content && !/log in|sign in|sign up|create an account|enjoy the videos and music|discover recipes, home ideas/i.test(content))values.push(content);
    }
  }
  return [...new Set(values)].join('\n').slice(0,10000);
}
