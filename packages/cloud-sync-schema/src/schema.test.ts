import { describe, expect, it } from 'vitest';
import sampleSnapshot from './fixtures/sample-snapshot.json';
import { parseCloudProjectSnapshot, safeParseCloudProjectSnapshot } from './schema';

describe('cloudProjectSnapshotSchema', () => {
  it('validates the sample fixture', () => {
    const parsed = parseCloudProjectSnapshot(sampleSnapshot);
    expect(parsed.schema_version).toBe(1);
    expect(parsed.project.name).toBe('Sample Stream VOD');
    expect(parsed.clips).toHaveLength(1);
  });

  it('rejects invalid schema version', () => {
    const result = safeParseCloudProjectSnapshot({ ...sampleSnapshot, schema_version: 2 });
    expect(result.success).toBe(false);
  });
});
