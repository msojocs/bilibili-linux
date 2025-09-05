// SponsorBlock API 类型定义

// 通用响应类型
export interface ApiResponse<T> {
  data: T;
  status: number;
}

// 分段类型
export const SegmentTypeDict = {
  Sponsor: 'sponsor',
  Intro: 'intro',
  Outro: 'outro',
  Interaction: 'interaction',
  SelfPromo: 'selfpromo',
  MusicOfftopic: 'music_offtopic',
  Preview: 'preview',
  Filler: 'filler',
} as const
export type SegmentType = typeof SegmentTypeDict[keyof typeof SegmentTypeDict];
// 分段信息
export interface Segment {
  actionType: string;
  category: SegmentType;
  description?: string;
  segment: [number, number]; // [开始时间, 结束时间]
  userID: string;
  UUID: string;
  videoDuration: number;
  votes: number;
}

// 获取分段请求参数
export interface GetSegmentsParams {
  categories?: SegmentType[];
  cid: number
  videoID: string;
}

// 提交分段请求参数
export interface SubmitSegmentParams {
  category: SegmentType;
  description?: string;
  endTime: number;
  startTime: number;
  userID: string;
  videoDuration: number;
  videoID: string;
}

// 投票请求参数
export interface VoteParams {
  type: 1 | 0 | -1; // 1: 赞成, 0: 撤销投票, -1: 反对
  userID: string;
  UUID: string;
}

// 查看分段请求参数
export interface ViewSegmentParams {
  userID: string;
  UUID: string;
}

// 用户统计信息
export interface UserStats {
  minutesSaved: number;
  segmentCount: number;
  userID: string;
  userName: string;
  viewCount: number;
}

export interface BigModelResponse {
  choices: BigModelChioce[]
  error?: {
    code: string
    message: string
  }
}
export interface BigModelChioce {
  message: {
    role: string
    content: string
  }
}
export interface DetectResult {
  desc: string
  end: number
  start: number
}