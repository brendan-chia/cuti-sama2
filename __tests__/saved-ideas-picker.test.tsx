import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SavedIdeasPicker } from '@/features/inspiration/saved-ideas-picker';
const mockLoad=jest.fn();
jest.mock('@/features/inspiration/service',()=>({loadInspiration:()=>mockLoad()}));
test('only completed analyses can supply place names for trip confirmation',async()=>{
 mockLoad.mockResolvedValue([{id:'1',status:'ready',folder:'Japan',analysis:{title:'Kyoto food',places:[{name:'Nishiki Market',location:'Kyoto'}]}},{id:'2',status:'needs_input',folder:'Japan',analysis:null}]);
 const choose=jest.fn();const screen=await render(<SavedIdeasPicker onChoose={choose} />);
 await fireEvent.press(screen.getByText('Choose from my saved inspiration'));
 await waitFor(()=>expect(screen.getByText('Kyoto food')).toBeTruthy());
 expect(choose).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByText('Kyoto food'));
 expect(choose).toHaveBeenCalledWith('Nishiki Market, Kyoto');
 expect(screen.queryByText('Kyoto food')).toBeNull();
});
