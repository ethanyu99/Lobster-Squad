const USER_ID_KEY = 'openclaw-user-id';

export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function getShortUserId(): string {
  return getUserId().slice(0, 8);
}
