import cuid from 'cuid';

export const generateAttendeeId = () => {
  return cuid();
};