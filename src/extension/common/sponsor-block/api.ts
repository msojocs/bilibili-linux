import { GET, POST } from '../http';
import { API_ENDPOINTS, DEFAULT_HEADERS, CLIENT_INFO } from './constants';
import type {
  GetSegmentsParams,
  Segment,
  SubmitSegmentParams,
  VoteParams,
  ViewSegmentParams,
  UserStats
} from './types';

/**
 * 获取视频分段
 * @param params 请求参数
 * @returns 分段列表
 */
export async function getSegments(params: GetSegmentsParams): Promise<Segment[]> {
  const { videoID, categories } = params;
  
  let url = `${API_ENDPOINTS.GET_SEGMENTS}?videoID=${videoID}`;
  
  // 添加分类过滤
  if (categories && categories.length > 0) {
    url += `&categories=${JSON.stringify(categories)}`;
  }
  
  const response = await GET(url, DEFAULT_HEADERS);
  
  if (response.status === 200) {
    return JSON.parse(response.responseText);
  } else {
    throw new Error(`获取分段失败: ${response.status} ${response.statusText}`);
  }
}

/**
 * 提交新分段
 * @param params 提交参数
 * @returns 新分段的UUID
 */
export async function submitSegment(params: SubmitSegmentParams): Promise<string> {
  const {
    videoID,
    startTime,
    endTime,
    category,
    userID,
    videoDuration,
    description = ''
  } = params;
  
  const body = JSON.stringify({
    videoID,
    startTime,
    endTime,
    category,
    userID,
    videoDuration,
    description,
    ...CLIENT_INFO
  });
  
  const response = await POST(API_ENDPOINTS.SUBMIT_SEGMENT, body, DEFAULT_HEADERS);
  
  if (response.status === 200) {
    return JSON.parse(response.responseText);
  } else {
    throw new Error(`提交分段失败: ${response.status} ${response.statusText}`);
  }
}

/**
 * 对分段进行投票
 * @param params 投票参数
 * @returns 投票结果
 */
export async function voteOnSegment(params: VoteParams): Promise<boolean> {
  const { UUID, userID, type } = params;
  
  const url = `${API_ENDPOINTS.VOTE}?UUID=${UUID}&userID=${userID}&type=${type}`;
  
  const response = await GET(url, DEFAULT_HEADERS);
  
  if (response.status === 200) {
    return true;
  } else {
    throw new Error(`投票失败: ${response.status} ${response.statusText}`);
  }
}

/**
 * 标记分段为已查看
 * @param params 查看参数
 * @returns 操作结果
 */
export async function viewSegment(params: ViewSegmentParams): Promise<boolean> {
  const { UUID, userID } = params;
  
  const url = `${API_ENDPOINTS.VIEW_SEGMENT}?UUID=${UUID}&userID=${userID}`;
  
  const response = await GET(url, DEFAULT_HEADERS);
  
  if (response.status === 200) {
    return true;
  } else {
    throw new Error(`标记查看失败: ${response.status} ${response.statusText}`);
  }
}

/**
 * 获取用户统计信息
 * @param userID 用户ID
 * @returns 用户统计信息
 */
export async function getUserStats(userID: string): Promise<UserStats> {
  const url = `${API_ENDPOINTS.USER_STATS}?userID=${userID}`;
  
  const response = await GET(url, DEFAULT_HEADERS);
  
  if (response.status === 200) {
    return JSON.parse(response.responseText);
  } else {
    throw new Error(`获取用户统计失败: ${response.status} ${response.statusText}`);
  }
}