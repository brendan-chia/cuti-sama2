import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { WishlistInspiration } from '@/features/inspiration/wishlist-inspiration';
const mockQueue=jest.fn();
const mockPending=jest.fn();
const idea={id:'idea',status:'ready',folder:'Japan',analysis:{title:'Kyoto food',places:[{name:'Nishiki Market',location:'Kyoto'}]}};
jest.mock('@/features/inspiration/service',()=>({loadInspiration:jest.fn(async()=>[idea])}));
jest.mock('@/features/inspiration/planning',()=>({queueInspiration:(...args:unknown[])=>mockQueue(...args),pendingInspiration:()=>mockPending()}));
beforeEach(()=>{mockQueue.mockReset().mockResolvedValue(undefined);mockPending.mockReset().mockResolvedValue(null);});
it('attaches analyzed places during Wishlist without submitting country choices',async()=>{
 const screen=await render(<WishlistInspiration tripId="trip" />);
 await fireEvent.press(screen.getByText('Choose from my saved inspiration'));
 await waitFor(()=>expect(screen.getByText('Use all 1 place')).toBeTruthy());
 await fireEvent.press(screen.getByText('Use all 1 place'));
 await waitFor(()=>expect(screen.getByText('Nishiki Market, Kyoto')).toBeTruthy());
 expect(mockQueue).toHaveBeenCalledWith('trip','idea');
});
it('restores the queued analysis after returning to Wishlist',async()=>{
 mockPending.mockResolvedValue('idea');
 const screen=await render(<WishlistInspiration tripId="trip" />);
 await waitFor(()=>expect(screen.getByText('Nishiki Market, Kyoto')).toBeTruthy());
 expect(mockQueue).not.toHaveBeenCalled();
});
it('reports failed queue persistence without claiming places were attached',async()=>{
 mockQueue.mockRejectedValue(new Error('offline'));
 const screen=await render(<WishlistInspiration tripId="trip" />);
 await fireEvent.press(screen.getByText('Choose from my saved inspiration'));
 await waitFor(()=>expect(screen.getByText('Use all 1 place')).toBeTruthy());
 await fireEvent.press(screen.getByText('Use all 1 place'));
 await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.queryByText('Saved places for this trip')).toBeNull();
});
