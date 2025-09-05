
import { createSlice } from '@reduxjs/toolkit';

export interface CounterState {
  lang: string
}
const initialState: CounterState = {
  lang: localStorage.lang || 'zhCn'
};

// 创建一个 Slice 
export const counterSlice = createSlice({
  name: 'storage',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    changeLanguage: (state, action) => {
      state.lang = action.payload;
      localStorage.setItem('lang', state.lang);
      window.switchLanguage(state.lang)
    },
    // 数据同步方法
    storageSync: (state, action) => {
      // 合并同步的状态数据
      window.switchLanguage(action.payload.lang)
      return {
        ...state,
        ...action.payload
      };
    },
  },
});
export const { storageSync, changeLanguage } = counterSlice.actions;

// 默认导出
export default counterSlice.reducer;

