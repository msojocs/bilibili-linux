import { StrictMode } from 'react';
import PlayerPanel from './PlayerPanel';
import LocaleProvider from '../LocaleProvider';
import { Provider } from 'react-redux';
import store from '../store';
const SkipNoticeWrap = () => {
  return (
    <StrictMode>
      <Provider store={store}>
        <LocaleProvider>
          <PlayerPanel />
        </LocaleProvider>
      </Provider>
    </StrictMode>
  );
};

export default SkipNoticeWrap;
