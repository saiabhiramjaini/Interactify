import { randomBytes, randomInt, timingSafeEqual } from 'crypto';

const ROOM_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const ROOM_ID_LENGTH = 6;

export const generateRoomId = (): string => {
  let roomId = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    roomId += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
  }
  return roomId;
};

export const normalizeRoomId = (roomId: string): string => roomId.trim().toUpperCase();

export const generateOwnerToken = (): string => randomBytes(24).toString('base64url');

export const tokensMatch = (expected: string | undefined, actual: string): boolean => {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
};
