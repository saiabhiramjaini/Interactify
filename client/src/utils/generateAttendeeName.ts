import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

export const generateAttendeeName = () =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: ' ',
    length: 3,
  });
