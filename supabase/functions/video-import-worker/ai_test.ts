import { mergeObservations } from './ai.ts';
Deno.test('deduplicates place evidence without skipping video frames',()=>{
 const result=mergeObservations([{name:'Tokyo Tower',evidence:'Frame at 1s: sign'}],[{name:'tokyo tower',evidence:'Frame at 2s: sign'},{name:'Meiji Jingu',evidence:'Frame at 3s: sign'}]);
 if(result.length!==2||result[0].evidence!=='Frame at 1s: sign')throw new Error('Evidence merge failed');
});
