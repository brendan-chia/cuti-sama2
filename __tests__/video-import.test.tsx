import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { VideoImportPanel } from '@/features/quest/video-import-panel';
import { latestVideoImport, startVideoImport, videoStatus } from '@/features/quest/video-import-service';
jest.mock('@/features/quest/video-import-service',()=>({latestVideoImport:jest.fn(),startVideoImport:jest.fn(),videoStatus:jest.fn()}));
const queued={importId:'11111111-1111-4111-8111-111111111111',state:'queued',processedFrames:0,totalFrames:0,audioDone:false,message:'Waiting for worker.',workerOnline:false,candidates:[]};
beforeEach(()=>{jest.clearAllMocks();(latestVideoImport as jest.Mock).mockResolvedValue(null);});
it('queues video analysis and shows offline status without claiming completion',async()=>{
 (startVideoImport as jest.Mock).mockResolvedValue(queued);
 const screen=await render(<VideoImportPanel tripId="trip" sourceUrl="https://instagram.com/reel/example/" caption="Tokyo" onConfirmed={jest.fn()}/>);
 await fireEvent.press(screen.getByText('Analyse audio & every frame'));
 await waitFor(()=>expect(screen.getByText('Waiting for worker.')).toBeTruthy());
 expect(startVideoImport).toHaveBeenCalledWith('trip','https://instagram.com/reel/example/','Tokyo');
 expect(screen.getByText(/local worker is offline/)).toBeTruthy();
 expect(screen.queryByText('Confirm 0 places')).toBeNull();
});
it('restores progress and allows cancellation',async()=>{
 (latestVideoImport as jest.Mock).mockResolvedValue({...queued,state:'running',totalFrames:100,processedFrames:30,audioDone:true,workerOnline:true});
 (videoStatus as jest.Mock).mockResolvedValue({...queued,state:'cancelled',message:'Video analysis cancelled.'});
 const screen=await render(<VideoImportPanel tripId="trip" sourceUrl="" caption="" onConfirmed={jest.fn()}/>);
 await waitFor(()=>expect(screen.getByText('30 / 100 frames · Audio complete')).toBeTruthy());
 await fireEvent.press(screen.getByText('Cancel video analysis'));
 await waitFor(()=>expect(screen.getByText('Video analysis cancelled.')).toBeTruthy());
 expect(videoStatus).toHaveBeenCalledWith(queued.importId,'cancel');
});
