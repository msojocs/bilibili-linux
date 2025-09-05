// SponsorBlock API 常量定义

// API 基础 URL
export const API_BASE_URL = 'https://bsbsb.top/api';


// API 端点
export const API_ENDPOINTS = {
  // 获取视频分段
  GET_SEGMENTS: `${API_BASE_URL}/skipSegments`,
  
  // 提交新分段
  SUBMIT_SEGMENT: `${API_BASE_URL}/skipSegments`,
  
  // 对分段进行投票
  VOTE: `${API_BASE_URL}/voteOnSponsorTime`,
  
  // 查看分段
  VIEW_SEGMENT: `${API_BASE_URL}/viewedVideoSponsorTime`,
  
  // 获取用户统计信息
  USER_STATS: `${API_BASE_URL}/userInfo`,
};

// 请求头
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// 客户端标识
export const CLIENT_INFO = {
  clientName: 'BilibiliSponsorBlock',
  clientVersion: '1.0.0',
};