
import { createSlice } from '@reduxjs/toolkit';

export interface SponsorState {
  bigmodelToken: string
  enable: boolean
  isSponsorAIDetect: boolean
  libPath: string
  whisperProxy: string
}
const initialState: SponsorState = JSON.parse(localStorage.getItem('sponsor_block_setting') || '{}')

// 创建一个 Slice 
export const sponsorSlice = createSlice({
  name: 'storage',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    // 定义一个加的方法
    switchSponsorBlock: (state) => {
      state.enable = !state.enable;
    },
    switchSponsorAIDetect: (state) => {
      state.isSponsorAIDetect = !state.isSponsorAIDetect;
    },
    updateBigmodelToken: (state, action) => {
      state.bigmodelToken = action.payload;
    },
    updateWhisperProxy: (state, action) => {
      state.whisperProxy = action.payload;
    },
    saveSponsorSetting: (state, action) => {
      state.enable = action.payload.enable;
      state.isSponsorAIDetect = action.payload.isSponsorAIDetect;
      state.bigmodelToken = action.payload.bigmodelToken;
      state.whisperProxy = action.payload.whisperProxy;
      state.libPath = action.payload.libPath;
      localStorage.setItem('sponsor_block_setting', JSON.stringify(state));
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
  updateWhisperProxy,
  switchSponsorBlock,
  sponsorSyncState,
  saveSponsorSetting,
} = sponsorSlice.actions;

// 默认导出
export default sponsorSlice.reducer;

