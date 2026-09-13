import { useEffect } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import InspirationFolder from '@/app/inspiration';
const mockEffect=useEffect;
jest.mock('expo-router',()=>({useFocusEffect:(effect:()=>void|(()=>void))=>mockEffect(effect,[effect])}));
jest.mock('@/features/inspiration/use-inspiration',()=>({UseInspiration:()=>null}));
const mockLoad=jest.fn();const mockSave=jest.fn();const mockAnalyze=jest.fn();const mockRemove=jest.fn();
jest.mock('@/features/inspiration/service',()=>({loadInspiration:()=>mockLoad(),saveInspiration:(input:unknown)=>mockSave(input),analyzeInspiration:(id:string)=>mockAnalyze(id),removeInspiration:(id:string)=>mockRemove(id)}));
const idea={id:'idea',folder:'Thailand',source_url:'https://www.tiktok.com/@travel/video/123',caption:'Caption',status:'ready',message:'Ready',analysis:{title:'A lake escape',summary:'A quiet day by the lake.',places:[{name:'Cheow Lan Lake',location:'Thailand',evidence:'Video 1 at 18s: visible name'}],planningNotes:[],tags:['nature']}};
beforeEach(()=>{mockLoad.mockReset().mockResolvedValue([idea]);mockSave.mockReset().mockResolvedValue('idea');mockAnalyze.mockReset().mockResolvedValue(undefined);mockRemove.mockReset().mockResolvedValue(undefined);});
it('prioritizes places and reveals evidence and management actions on demand',async()=>{
 const screen=await render(<InspirationFolder />);
 await waitFor(()=>expect(screen.getByText('Cheow Lan Lake')).toBeTruthy());
 expect(screen.queryByText('Video 1 at 18s: visible name')).toBeNull();
 await fireEvent.press(screen.getByRole('button',{name:'Details for A lake escape'}));
 expect(screen.getByText('Video 1 at 18s: visible name')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button',{name:'Remove saved link'}));
 expect(mockRemove).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('button',{name:'Confirm removal'}));
 await waitFor(()=>expect(mockRemove).toHaveBeenCalledWith('idea'));
});
it('opens editing with the original values and preserves save and analysis behavior',async()=>{
 const screen=await render(<InspirationFolder />);
 await waitFor(()=>expect(screen.getByText('Cheow Lan Lake')).toBeTruthy());
 await fireEvent.press(screen.getByRole('button',{name:'Details for A lake escape'}));
 await fireEvent.press(screen.getByRole('button',{name:'Edit folder or caption'}));
 expect(screen.getByLabelText('Reel or travel link').props.value).toBe(idea.source_url);
 await fireEvent.press(screen.getByRole('button',{name:'Save & analyze'}));
 await waitFor(()=>expect(mockAnalyze).toHaveBeenCalledWith('idea'));
 expect(mockSave).toHaveBeenCalledWith({sourceUrl:idea.source_url,folder:'Thailand',caption:'Caption'});
});
it('keeps search and empty results usable',async()=>{
 const screen=await render(<InspirationFolder />);
 await waitFor(()=>expect(screen.getByText('Cheow Lan Lake')).toBeTruthy());
 await fireEvent.changeText(screen.getByLabelText('Search saved ideas'),'Kyoto');
 expect(screen.getByText('Nothing here just yet.')).toBeTruthy();
 expect(screen.queryByText('Cheow Lan Lake')).toBeNull();
});
