// index.ts 文件

import { configureStore } from "@reduxjs/toolkit";
import storageSlice, {counterSlice} from "./storage.ts";

// configureStore创建一个redux数据
const store = configureStore({
  // 合并多个Slice
  reducer: {
    counter: storageSlice
  },
});

export default store;


// 从 store 本身推断出 `RootState` 和 `AppDispatch` 类型
export type RootState = ReturnType<typeof store.getState>
// 推断出类型: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch

interface DataSync {
  key: string;
  value: string | number;
}
// TODO: 多窗口数据同步
document.addEventListener('datasync', (_ev: CustomEventInit<DataSync>) => {
  store.dispatch(counterSlice.actions.switchSponsorAIDetect())
})