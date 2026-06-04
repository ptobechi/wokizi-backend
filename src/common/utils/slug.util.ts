import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

export function generateSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, trim: true });
}

export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = uuidv4().split('-')[0];
  return `${base}-${suffix}`;
}
