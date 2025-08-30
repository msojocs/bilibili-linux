
import { createSlice } from '@reduxjs/toolkit';

export interface CounterState {
  bigmodelToken: string
  enable: boolean
  isSponsorAIDetect: boolean
}
const initialState: CounterState = {
  enable: localStorage.sponsor_block_enable === "true",
  isSponsorAIDetect: localStorage.sponsor_block_ai_detect === "true",
  bigmodelToken: localStorage.sponsor_block_token_bigmodel || "",
};

// 创建一个 Slice 
export const sponsorSlice = createSlice({
  name: 'storage',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    // 定义一个加的方法
    switchSponsorBlock: (state) => {
      state.enable = !state.enable;
      localStorage.setItem('sponsor_block_enable', `${state.enable}`);
    },
    switchSponsorAIDetect: (state) => {
      state.isSponsorAIDetect = !state.isSponsorAIDetect;
      localStorage.setItem('sponsor_block_ai_detect', `${state.isSponsorAIDetect}`);
    },
    updateBigmodelToken: (state, action) => {
      state.bigmodelToken = action.payload;
      localStorage.sponsor_block_token_bigmodel = action.payload;
    },
    // 数据同步方法
    sponsorSyncState: (state, action) => {
      // 合并同步的状态数据
      return {
        ...state,
        ...action.payload
      };
    },
  },
});
export const {
  switchSponsorAIDetect,
  updateBigmodelToken,
  switchSponsorBlock,
  sponsorSyncState
} = sponsorSlice.actions;

// 默认导出
export default sponsorSlice.reducer;

