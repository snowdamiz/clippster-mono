import { describe, expect, it } from 'vitest';
import type { Project, AuthUser } from './index';

describe('@clippster/shared-types', () => {
  it('exports Project shape with snake_case fields', () => {
    const project: Project = {
      id: 'abc',
      name: 'Test',
      description: null,
      thumbnail_path: null,
      parent_id: null,
      created_at: 1,
      updated_at: 2,
    };
    expect(project.thumbnail_path).toBeNull();
  });

  it('exports AuthUser shape', () => {
    const user: AuthUser = {
      id: 1,
      email: 'test@example.com',
      account_type: 'personal',
    };
    expect(user.account_type).toBe('personal');
  });
});
