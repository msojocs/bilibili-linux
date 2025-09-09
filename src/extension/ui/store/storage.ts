
import { createSlice } from '@reduxjs/toolkit';
import { requestContent } from '../../document/communication';
import { createLogger } from '../../../common/log';


const log = createLogger('storage')

export interface CounterState {
  lang: string
}
const initialState: CounterState = {
  lang: 'zhCn'
};
// 创建一个 Slice 
export const storageSlice = createSlice({
  name: 'storage',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    changeLanguage: (state, action) => {
      state.lang = action.payload;
      requestContent<string>('setStorage', { key: 'lang', value: state.lang });
      const targetDocument = parent === window ? document : parent.document
      targetDocument.dispatchEvent(new CustomEvent('changeLanguage', { detail: state.lang }))
    },
    // 数据同步方法
    storageSync: (state, action) => {
      // 合并同步的状态数据
      log.info('check lang', state.lang, action.payload.lang)
      if (state.lang !== action.payload.lang) {
        const targetDocument = parent === window ? document : parent.document
        targetDocument.dispatchEvent(new CustomEvent('changeLanguage', { detail: action.payload.lang }))
      }
      return {
        ...state,
        ...action.payload
      };
    },
  },
});
export const { storageSync, changeLanguage } = storageSlice.actions;

// 默认导出
export default storageSlice.reducer;

