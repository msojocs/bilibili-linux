## 步骤

1. 使用 bvid 通过 detail 是会获取失败的
2. 在取到动态信息时，想办法存入dynamic_id，可以关联bvid和dynamic_id (Record<bvid, dynamic_id>)
3. 获取动态详情： https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=
4. card里面可以取到ep_id