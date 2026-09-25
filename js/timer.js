// 조리 타이머. '끝나는 시각' 을 기억하므로 다른 앱에 갔다 와도, 화면이 잠깐 꺼져도 시간이 맞다.
export const newTimer = (sec) => ({ total: sec, left: sec, endsAt: null });

export const remaining = (t, now) => (t.endsAt ? Math.max(0, (t.endsAt - now) / 1000) : t.left);
export const isRunning = (t) => t.endsAt !== null;
export const isDone = (t, now) => remaining(t, now) <= 0;

export function start(t, now) {
  if (isRunning(t) || t.left <= 0) return t;
  return { ...t, endsAt: now + t.left * 1000 };
}

export function pause(t, now) {
  if (!isRunning(t)) return t;
  return { ...t, left: remaining(t, now), endsAt: null };
}

export const reset = (t) => newTimer(t.total);

// 진행률 0~100
export const progress = (t, now) => Math.round((1 - remaining(t, now) / t.total) * 100);
