import { createSlice } from '@reduxjs/toolkit';

export interface DanmakuState {
  blockLevel: number
  isBlockVipColor: boolean
}

const initialState: DanmakuState = {
  blockLevel: parseInt(localStorage.getItem('dm_filter_weight') || '0'),
  isBlockVipColor: localStorage.getItem('dm_filter_blockvip') === 'true',
};

// 创建一个 Slice 
export const danmakuSlice = createSlice({
  name: 'danmaku',
  initialState,
  // 定义 reducers 并生成关联的操作
  reducers: {
    // 更新屏蔽等级
    updateBlockLevel: (state, action) => {
      state.blockLevel = action.payload;
      localStorage.setItem('dm_filter_weight', `${action.payload}`);
    },
    // 切换屏蔽大会员彩色弹幕
    switchBlockVipColor: (state) => {
      state.isBlockVipColor = !state.isBlockVipColor;
      localStorage.setItem('dm_filter_blockvip', `${state.isBlockVipColor}`);
    },
    // 数据同步方法
    danmakuSyncState: (state, action) => {
      // 合并同步的状态数据
      return {
        ...state,
        ...action.payload
      };
    },
  },
});

export const {
  updateBlockLevel,
  switchBlockVipColor,
  danmakuSyncState
} = danmakuSlice.actions;

// 默认导出
export default danmakuSlice.reducer;