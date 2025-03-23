const sessionId = (
  Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
).toUpperCase();

export default function getSessionId() {
  return sessionId;
}
