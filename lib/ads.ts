/**
 * Ad video config for "watch to earn credits".
 * REQUIRED_WATCH_DURATION_SEC is the same for all ads — change here to vary (e.g. 30).
 */
export const REQUIRED_WATCH_DURATION_SEC = 30

export type AdVideo = {
  id: string
  /** Video URL; use /videos/xxx.mp4 for files in public/videos/. */
  src: string
  /** Optional CTA link (opens in new tab). */
  link?: string
  /** Optional label for the link, e.g. "了解更多". */
  linkLabel?: string
}

/** CTA link for all ad videos (opens in new tab). */
export const ADS_CTA_URL = 'https://freedombusiness.io/aigames'

/** Videos in public/videos/; required watch time is REQUIRED_WATCH_DURATION_SEC for all. */
export const AD_VIDEOS: AdVideo[] = [
  { id: 'ad-1', src: '/videos/ad1.mp4', link: ADS_CTA_URL, linkLabel: '了解更多' },
  { id: 'ad-2', src: '/videos/ad2.mp4', link: ADS_CTA_URL, linkLabel: '了解更多' },
  { id: 'ad-3', src: '/videos/ad3.mp4', link: ADS_CTA_URL, linkLabel: '了解更多' },
]

export function getRandomAd(): AdVideo {
  const list = AD_VIDEOS.length ? AD_VIDEOS : [defaultAd()]
  return list[Math.floor(Math.random() * list.length)]
}

function defaultAd(): AdVideo {
  return { id: 'default', src: '/videos/ad1.mp4', link: ADS_CTA_URL, linkLabel: '了解更多' }
}

/** Required watch time (seconds) for all ads — app-level setting. */
export function getRequiredWatchDuration(): number {
  return REQUIRED_WATCH_DURATION_SEC
}
