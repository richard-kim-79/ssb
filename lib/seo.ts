/** Canonical public base URL (used by metadata, sitemap, robots, OpenGraph). */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "써봄";
export const SITE_DESCRIPTION =
  "한국어 논술 답안을 AI가 채점하고 첨삭합니다. 문제와 채점 기준을 올리면 총점·영역별 점수·상세 피드백과 인라인 첨삭을 받아보세요.";
