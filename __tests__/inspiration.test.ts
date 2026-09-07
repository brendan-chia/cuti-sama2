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
