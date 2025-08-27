// 根据 playurl.json 自动生成
// 不使用 any，数组元素类型已拆分

export interface ThPlayurlData {
  dimension: ThPlayurlDimension;
  video_info: ThPlayurlVideoInfo;
}

export interface ThPlayurlDimension {
  height: number;
  rotate: number;
  width: number;
}

export interface ThPlayurlVideoInfo {
  dash_audio: ThPlayurlDashAudio[];
  quality: number;
  stream_list: ThPlayurlStreamList[];
  timelength: number;
}

export interface ThPlayurlDashAudio {
  backup_url: string[];
  bandwidth: number;
  base_url: string;
  codecid: number;
  id: number;
  md5: string;
  size: number;
}

export interface ThPlayurlStreamList {
  dash_video: ThPlayurlDashVideo;
  stream_info: ThPlayurlStreamInfo;
}

export interface ThPlayurlDashVideo {
  audio_id: number;
  backup_url: string[];
  bandwidth: number;
  base_url: string;
  codecid: number;
  md5: string;
  size: number;
}

export interface ThPlayurlStreamInfo {
  description: string;
  display_desc: string;
  intact: boolean;
  need_login: boolean;
  need_vip: boolean;
  new_description: string;
  no_rexcode: boolean;
  quality: number;
}
