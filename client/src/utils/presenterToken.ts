// The owner token proves to the server that this browser created the session.
// It lives in localStorage (not the URL) so it isn't leaked by sharing links.
const key = (roomCode: string) => `interactify:presenter:${roomCode.toUpperCase()}`;

export const savePresenterToken = (roomCode: string, token: string) => {
  try {
    localStorage.setItem(key(roomCode), token);
  } catch {
    // Storage unavailable (e.g. private mode); presenter controls won't survive a reload
  }
};

export const getPresenterToken = (roomCode: string): string | null => {
  try {
    return localStorage.getItem(key(roomCode));
  } catch {
    return null;
  }
};

export const clearPresenterToken = (roomCode: string) => {
  try {
    localStorage.removeItem(key(roomCode));
  } catch {
    // Nothing to clean up
  }
};
