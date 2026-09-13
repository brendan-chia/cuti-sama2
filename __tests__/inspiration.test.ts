import { inspirationUrl, InspirationInputSchema, InspirationAnalysisSchema } from '../packages/contracts/src/inspiration';
test('removes sharing trackers but preserves post identifiers',()=>{
 expect(inspirationUrl('https://www.youtube.com/watch?v=abc&si=tracking&utm_source=share#top')).toBe('https://www.youtube.com/watch?v=abc');
 expect(inspirationUrl('https://www.instagram.com/p/abc/?img_index=2&igsh=tracking')).toBe('https://www.instagram.com/p/abc/?img_index=2');
});
test.each(['http://instagram.com/p/a','https://user:pass@instagram.com/p/a','https://127.0.0.1/a','javascript:alert(1)'])('rejects unsafe link %s',url=>expect(()=>inspirationUrl(url)).toThrow());
test('allows saving other social networks without promising automatic access',()=>{
 expect(InspirationInputSchema.parse({sourceUrl:'https://social.example/post/123'}).folder).toBe('Travel ideas');
});
test('requires evidence for extracted places',()=>{
 expect(InspirationAnalysisSchema.safeParse({title:'Kyoto',summary:'Food',places:[{name:'Market',location:'Kyoto',evidence:''}],tags:[],planningNotes:[]}).success).toBe(false);
});

import { deduplicateInspirationPlaces, InspirationSchema } from '../packages/contracts/src/inspiration';
test('merges repeated Khao Sok entries and retains both scene references',()=>{
 const places=[{name:'Khao Sok National Park & Cheow Lan Lake',location:'',evidence:'Video 1 at 17.000s: turquoise lake'},{name:'Khao Sok National Park & Cheow Lan Lake',location:'',evidence:'Video 1 at 18.600s: visible place name'}];
 const result=deduplicateInspirationPlaces(places);
 expect(result).toHaveLength(1);expect(result[0].evidence).toContain('17.000s');expect(result[0].evidence).toContain('18.600s');
 expect(places[0].evidence).not.toContain('18.600s');
});
test('normalizes spacing, punctuation and case without merging different locations',()=>{
 expect(deduplicateInspirationPlaces([{name:'Market & Cafe',location:'Kyoto',evidence:'a'},{name:' market and cafe! ',location:' Kyoto ',evidence:'b'},{name:'Market & Cafe',location:'Tokyo',evidence:'c'}])).toHaveLength(2);
});
test('deduplicates old saved analyses on load without reanalysis',()=>{
 const place={name:'Khao Sok',location:'Thailand',evidence:'Video 1 at 17s: sign'};
 const idea=InspirationSchema.parse({id:'11111111-1111-4111-8111-111111111111',source_url:'https://example.com',folder:'Trip',caption:'',status:'ready',analysis:{title:'Thailand',summary:'',places:[place,{...place,evidence:'Video 1 at 18s: sign'}],tags:[],planningNotes:[]},message:'',source_text:'',provider:'openai',model:'test',created_at:'',updated_at:''});
 expect(idea.analysis?.places).toHaveLength(1);
});
