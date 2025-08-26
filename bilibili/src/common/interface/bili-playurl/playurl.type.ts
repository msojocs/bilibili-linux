// 根据 tmp/playurl.json 自动生成的类型定义文件
// 注意：Array 类型已拆分为具体类型，未使用 any

export interface VideoInfo {
  accept_description: string[];
  accept_format: string;
  accept_quality: number[];
  bp: number;
  code: number;
  dash: DashInfo;
  durls: Durl[];
  fnval: number;
  fnver: number;
  format: string;
  from: string;
  has_paid: boolean;
  is_preview: number;
  last_play_cid?: number;
  last_play_time?: number;
  message: string;
  no_rexcode: number;
  quality: number;
  result: string;
  seek_param: string;
  seek_type: string;
  status: number;
  support_formats: SupportFormat[];
  timelength: number;
  type: string;
  video_codecid: number;
  video_project: boolean;
  video_type: string;
  vip_status: number;
  vip_type: number;
}

export interface DashInfo {
  audio: DashAudio[];
  dolby: {
    audio: []
    type: number
  }
  duration: number;
  min_buffer_time: number;
  minBufferTime: number;
  video: DashVideo[];
}
export interface DashVideo {
  backup_url: string[]
  backupUrl: string[]
  bandwidth: number
  base_url: string
  baseUrl: string
  codecid: number,
  codecs: string,
  frame_rate: string,
  frameRate: string,
  height: number
  id: number
  md5: string
  mime_type: string
  mimeType: string
  /**
   * 1:1
   */
  sar: string
  segment_base: {
      initialization: string
      index_range: string
  },
  SegmentBase: {
      Initialization: string
      indexRange: string
  },
  size: number
  start_with_sap: number
  startWithSAP: number
  width: number
}
export interface DashAudio {
  backup_url: string[]
  backupUrl: string[]
  bandwidth: number
  base_url: string
  baseUrl: string
  codecid: number,
  codecs: string,
  frame_rate: string,
  frameRate: string,
  height: number
  id: number
  md5: string
  mime_type: string
  mimeType: string
  sar: string
  segment_base: {
      initialization: string
      index_range: string
  },
  SegmentBase: {
      Initialization: string
      indexRange: string
  },
  size: number
  start_with_sap: number
  startWithSAP: number
  width: number
}
export interface Durl {
  ahead: string;
  backup_url: string[];
  length: number;
  order: number;
  size: number;
  url: string;
  vhead: string;
}

export interface SupportFormat {
  attribute?: number;
  codecs: string[];
  description?: string;
  display_desc: string;
  format: string;
  has_preview?: boolean;
  need_login?: boolean;
  need_vip?: boolean;
  new_description?: string;
  quality: number;
  sub_description?: string;
  superscript?: string;
}

export interface BiliPlayUrlResult {
  exp_info?: ExpInfo;
  play_check?: PlayCheck;
  play_view_business_info?: PlayViewBusinessInfo;
  video_info: VideoInfo;
}

export interface ExpInfo {
  buy_vip_donated_season: number;
}

export interface PlayCheck {
  play_detail?: string;
}

export interface PlayViewBusinessInfo {
  episode_info?: EpisodeInfo;
  season_info?: SeasonInfo;
  user_status?: UserStatus;
}

export interface EpisodeInfo {
  aid?: number;
  bvid?: string;
  cid?: number;
  delivery_business_fragment_video?: boolean;
  delivery_fragment_video?: boolean;
  ep_id?: number;
  ep_status?: number;
  interaction?: Interaction;
  long_title?: string;
  title?: string;
}

export interface Interaction {
  interaction?: boolean;
}

export interface SeasonInfo {
  season_id?: number;
  season_type?: number;
}

export interface UserStatus {
  follow_info?: FollowInfo;
  is_login?: number;
  pay_info?: PayInfo;
  vip_info?: VipInfo;
  watch_progress?: WatchProgress;
}

export interface FollowInfo {
  follow?: number;
  follow_status?: number;
}

export interface PayInfo {
  pay_check?: number;
  pay_pack_paid?: number;
  sponsor?: number;
}

export interface VipInfo {
  due_date?: number;
  real_vip?: boolean;
  status?: number;
  type?: number;
}

export interface WatchProgress {
  current_watch_progress?: number;
  last_ep_id?: number;
  last_ep_index?: string;
  last_time?: number;
}
