
import { createSlice } from '@reduxjs/toolkit';

export interface CounterState {
  isSponsorAIDetect: boolean
}
const initialState: CounterState = {
  isSponsorAIDetect: localStorage.sponsor_block_ai_detect === "true"
};

// 创建一个 Slice 
export const counterSlice = createSlice({
  name: 'storage',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    // 定义一个加的方法
    switchSponsorAIDetect: (state) => {
      state.isSponsorAIDetect = !state.isSponsorAIDetect;
      localStorage.setItem('sponsor_block_ai_detect', `${state.isSponsorAIDetect}`);
    },
  },
});
export const { switchSponsorAIDetect } = counterSlice.actions;

// 默认导出
export default counterSlice.reducer;

