import { createSlice } from '@reduxjs/toolkit';

export interface PlayState {
  isRelatedAutoPlay: boolean
}

const initialState: PlayState = {
  isRelatedAutoPlay: localStorage.getItem('related_auto_play') === 'true',
};

// 创建一个 Slice 
export const playSlice = createSlice({
  name: 'play',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    // 切换自动连播
    switchRelatedAutoPlay: (state) => {
      state.isRelatedAutoPlay = !state.isRelatedAutoPlay;
      localStorage.setItem('related_auto_play', `${state.isRelatedAutoPlay}`);
      // 同步到全局状态
      if (window.danmakuManage?.storyStore?.state) {
        window.danmakuManage.storyStore.state.relatedAutoplay = state.isRelatedAutoPlay;
      }
    },
    // 数据同步方法
    playSyncState: (state, action) => {
      // 合并同步的状态数据
      return {
        ...state,
        ...action.payload
      };
    },
  },
});

export const {
  switchRelatedAutoPlay,
  playSyncState
} = playSlice.actions;

// 默认导出
export default playSlice.reducer;