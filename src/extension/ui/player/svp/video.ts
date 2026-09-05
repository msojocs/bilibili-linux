import type { SvpStream } from "../../../common/svp";
import { getLatestSvpStream, getSvpStreamForQuality } from "../../../common/svp";

export const videoMatchesStream = (video: HTMLVideoElement, stream: SvpStream) => {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA || !Number.isFinite(video.duration)) return false
  if (stream.width && stream.height && video.videoWidth && video.videoHeight
    && (Math.abs(video.videoWidth - stream.width) > 2 || Math.abs(video.videoHeight - stream.height) > 2)) return false
  if (!stream.duration) return true
  // DASH duration is integer seconds while Chromium derives duration from
  // media timestamps, which commonly differs by 1-2 seconds.
  const tolerance = Math.max(3, stream.duration * 0.01)
  return Math.abs(video.duration - stream.duration) <= tolerance
}

export const getVideo = (targetStream?: SvpStream) => {
  const managed = window.danmakuManage?.rootStore?.mediaStore?.video
  const candidates = Array.from(document.querySelectorAll<HTMLVideoElement>('video:not(.bili-svp-video)'))
  if (managed && !candidates.includes(managed)) candidates.push(managed)
  const usable = candidates.filter(video => (
    video.isConnected
    && video.readyState >= HTMLMediaElement.HAVE_METADATA
    && (!targetStream || videoMatchesStream(video, targetStream))
  ))
  const score = (video: HTMLVideoElement) => {
    const rect = video.getBoundingClientRect()
    const visibleArea = Math.max(0, rect.width) * Math.max(0, rect.height)
    return (
      (!video.paused && !video.ended ? 32 : 0)
      + (visibleArea > 0 ? 16 : 0)
      + (video.currentSrc ? 8 : 0)
      + (video.videoWidth > 0 && video.videoHeight > 0 ? 4 : 0)
      + (video.currentTime > 0 ? 2 : 0)
      + Math.min(1, visibleArea / 1000000)
    )
  }
  return usable.sort((left, right) => score(right) - score(left))[0]
}
export const svpPlaybackEnabledKey = 'bili-svp-playback-enabled'

export const getSelectedQuality = () => {
  const selected = document.querySelector<HTMLElement>('.bpx-player-ctrl-quality-menu-item.bpx-state-active')
  const quality = Number(selected?.dataset.value)
  return Number.isFinite(quality) && quality > 0 ? quality : undefined
}

export const getStreamForCurrentVideo = (fallback?: SvpStream) => {
  const selected = getSvpStreamForQuality(getSelectedQuality())
  const video = getVideo()
  if (selected && (!video || videoMatchesStream(video, selected))) return selected
  const streams = Object.values(window.__biliSvpStreamsByQuality || {}).flat()
  if (video?.videoWidth && video.videoHeight) {
    const matching = streams.find(candidate => (
      candidate.width === video.videoWidth
      && candidate.height === video.videoHeight
      && videoMatchesStream(video, candidate)
    ))
    if (matching) return matching
  }
  // Once Chromium has metadata, never attach a stream whose dimensions or
  // duration belong to another playurl response. Wait for the matching DASH
  // response instead of silently replacing the current picture with it.
  if (video) {
    const candidate = fallback || getLatestSvpStream()
    return candidate && videoMatchesStream(video, candidate) ? candidate : undefined
  }
  return fallback || getLatestSvpStream()
}

export const outputFpsForPlayback = (targetFps: number, playbackRate: number) => (
  Math.max(1, Math.min(targetFps, Math.floor(targetFps / Math.max(1, playbackRate))))
)

export const waitForStreamVideo = async (stream: SvpStream, preferred?: HTMLVideoElement | null) => {
  const deadline = performance.now() + 5000
  while (performance.now() < deadline) {
    if (preferred?.isConnected
      && preferred.readyState >= HTMLMediaElement.HAVE_METADATA
      && videoMatchesStream(preferred, stream)) return preferred
    const video = getVideo(stream)
    if (video) return video
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
  return undefined
}
