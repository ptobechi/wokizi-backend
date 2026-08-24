import { publishFields, unpublishFields, suspendPublicationFields } from './service-publication.util';

describe('service-publication.util', () => {
  it('publishFields sets isPublished true and a fresh publishedAt', () => {
    const result = publishFields();
    expect(result.isPublished).toBe(true);
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('unpublishFields only clears isPublished, leaving publishedAt untouched', () => {
    const result = unpublishFields();
    expect(result).toEqual({ isPublished: false });
    expect('publishedAt' in result).toBe(false);
  });

  it('suspendPublicationFields clears both isPublished and publishedAt', () => {
    const result = suspendPublicationFields();
    expect(result).toEqual({ isPublished: false, publishedAt: null });
  });
});
