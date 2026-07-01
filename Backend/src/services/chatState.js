// State machine dùng chung cho mọi luồng chat (góp ý, tra cứu...) — 10 phút timeout.
// 1 user chỉ ở 1 luồng/state tại 1 thời điểm.
const userStates = new Map();

function setState(userId, data) {
  const ts = Date.now();
  const entry = { ...data, ts };
  userStates.set(userId, entry);
  setTimeout(() => {
    if (userStates.get(userId)?.ts === ts) userStates.delete(userId);
  }, 10 * 60 * 1000);
}

function getState(userId) {
  return userStates.get(userId) || null;
}

function clearState(userId) {
  userStates.delete(userId);
}

module.exports = { setState, getState, clearState };
