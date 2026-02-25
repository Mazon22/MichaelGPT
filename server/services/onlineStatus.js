const ONLINE_WINDOW_MINUTES = 2;
const ONLINE_WINDOW_MS = ONLINE_WINDOW_MINUTES * 60 * 1000;

function isOnlineByMs(lastSeenAtMs, nowMs = Date.now()) {
  if (!Number.isFinite(lastSeenAtMs)) return false;
  return nowMs - lastSeenAtMs <= ONLINE_WINDOW_MS;
}

module.exports = {
  ONLINE_WINDOW_MINUTES,
  ONLINE_WINDOW_MS,
  isOnlineByMs,
};
