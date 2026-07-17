/** Web-only stub so Expo web can render UI without wa-sqlite.wasm. */

type SqlResult = {
  rows: { _array: unknown[]; length: number; item: (i: number) => unknown };
  rowsAffected: number;
  changes: number;
  lastInsertRowId: number;
};

function emptyResult(): SqlResult {
  return {
    rows: {
      _array: [],
      length: 0,
      item: () => undefined,
    },
    rowsAffected: 0,
    changes: 0,
    lastInsertRowId: 0,
  };
}

class MockStatement {
  executeSync() {
    return emptyResult();
  }
  async executeAsync() {
    return emptyResult();
  }
  getFirstSync() {
    return null;
  }
  async getFirstAsync() {
    return null;
  }
  getAllSync() {
    return [];
  }
  async getAllAsync() {
    return [];
  }
  finalizeSync() {}
  async finalizeAsync() {}
}

class MockDatabase {
  execSync(_sql: string): void {}
  async execAsync(_sql: string): Promise<void> {}
  runSync(_sql: string, _params?: unknown[]): SqlResult {
    return emptyResult();
  }
  async runAsync(_sql: string, _params?: unknown[]): Promise<SqlResult> {
    return emptyResult();
  }
  getFirstSync(_sql: string, _params?: unknown[]): null {
    return null;
  }
  async getFirstAsync(_sql: string, _params?: unknown[]): Promise<null> {
    return null;
  }
  getAllSync(_sql: string, _params?: unknown[]): unknown[] {
    return [];
  }
  async getAllAsync(_sql: string, _params?: unknown[]): Promise<unknown[]> {
    return [];
  }
  prepareSync(_sql: string) {
    return new MockStatement();
  }
  async prepareAsync(_sql: string) {
    return new MockStatement();
  }
  closeSync(): void {}
  async closeAsync(): Promise<void> {}
}

export function openDatabaseSync(_name: string): MockDatabase {
  return new MockDatabase();
}

export async function openDatabaseAsync(_name: string): Promise<MockDatabase> {
  return new MockDatabase();
}

export default {
  openDatabaseSync,
  openDatabaseAsync,
};
