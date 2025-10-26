# Database Setup Guide

## Overview

Clippster uses SQLite for local data storage in the desktop client. The database is automatically initialized when the app starts, with migrations applied automatically.

## Location

- **Database file**: `clippster.db` (stored in Tauri's app data directory)
- **Migrations**: `src-tauri/migrations/`
- **Schema documentation**: `DATABASE_SCHEMA.md`

## Architecture

### Backend (Rust)
- **Plugin**: `tauri-plugin-sql` with SQLite support
- **Migrations**: Embedded SQL files loaded at runtime
- **Location**: `src-tauri/src/lib.rs`

### Frontend (TypeScript)
- **Service**: `src/services/database.ts` - provides typed API
- **Plugin**: `@tauri-apps/plugin-sql` - handles SQL queries
- **Composable**: `src/composables/useDatabase.ts` - legacy connection helper

## Usage

### Basic Example

```typescript
import { createProject, getAllProjects } from '@/services/database'

// Create a new project
const projectId = await createProject('My Video Project', 'Description here')

// Get all projects
const projects = await getAllProjects()
console.log(projects)
```

### Available Functions

#### Projects
- `createProject(name, description?)`
- `getProject(id)`
- `getAllProjects()`
- `updateProject(id, name?, description?)`
- `deleteProject(id)`

#### Prompts
- `createPrompt(name, content)`
- `getAllPrompts()`
- `updatePrompt(id, name?, content?)`
- `deletePrompt(id)`

#### Transcripts
- `createTranscript(projectId, rawJson, text, language?, duration?)`
- `getTranscriptByProjectId(projectId)`

#### Transcript Segments
- `createTranscriptSegment(transcriptId, startTime, endTime, text, segmentIndex, clipId?)`
- `getTranscriptSegments(transcriptId)`

#### Clips
- `createClip(projectId, filePath, options?)`
- `getClipsByProjectId(projectId)`
- `updateClip(id, updates)`
- `deleteClip(id)`

#### Intro/Outros
- `createIntroOutro(type, name, filePath, duration?)`
- `getAllIntroOutros(type?)`
- `deleteIntroOutro(id)`

#### Thumbnails
- `createThumbnail(clipId, filePath, width?, height?)`
- `getThumbnailByClipId(clipId)`

#### Search
- `searchTranscripts(query)` - Full-text search across project transcripts
- `searchSegments(query)` - Full-text search on transcript segments

### Search Examples

```typescript
import { searchTranscripts, searchSegments } from '@/services/database'

// Find projects mentioning "tutorial"
const projects = await searchTranscripts('tutorial')

// Find segments with multiple words (AND operator)
const segments = await searchSegments('subscribe AND like')

// Phrase search
const exact = await searchSegments('"call to action"')
```

## Adding Migrations

To add a new migration:

1. Create a new SQL file in `src-tauri/migrations/`:
   ```
   002_add_feature.sql
   ```

2. Write your migration SQL:
   ```sql
   -- Add new column to projects table
   ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';
   ```

3. Update `src-tauri/src/lib.rs` to include the new migration:
   ```rust
   vec![
       tauri_plugin_sql::Migration {
           version: 1,
           description: "initial_schema",
           sql: include_str!("../migrations/001_initial_schema.sql"),
           kind: tauri_plugin_sql::MigrationKind::Up,
       },
       tauri_plugin_sql::Migration {
           version: 2,
           description: "add_feature",
           sql: include_str!("../migrations/002_add_feature.sql"),
           kind: tauri_plugin_sql::MigrationKind::Up,
       },
   ]
   ```

4. Update TypeScript types in `src/services/database.ts` if needed

## Development

### Reset Database

To reset the database during development:

1. Find the database file location:
   - Windows: `%APPDATA%/com.clippster.app/`
   - macOS: `~/Library/Application Support/com.clippster.app/`
   - Linux: `~/.local/share/com.clippster.app/`

2. Delete `clippster.db` file

3. Restart the app - migrations will run automatically

### Testing Migrations

```bash
# Build and run in dev mode
cd src-tauri
cargo tauri dev
```

The migrations run automatically on app startup.

## Best Practices

1. **Use TypeScript service layer**: Don't call database directly from components
2. **Generate UUIDs**: Use `generateId()` helper for new records
3. **Timestamps**: Use `timestamp()` helper for Unix timestamps
4. **Transactions**: For complex operations, use database transactions
5. **Error handling**: Always wrap database calls in try/catch
6. **Type safety**: Leverage TypeScript interfaces for query results

## Troubleshooting

### Migration Fails
- Check SQL syntax in migration file
- Ensure foreign key constraints are valid
- Look at Tauri console logs for detailed errors

### Database Locked
- SQLite locks the entire database for writes
- Ensure you're not running multiple instances
- Consider using WAL mode for better concurrency (future enhancement)

### FTS Not Working
- Verify FTS5 is enabled in SQLite build
- Check that triggers are created correctly
- Rebuild FTS indexes if data was added before triggers

## Future Enhancements

- [ ] WAL mode for better concurrent access
- [ ] Database backups/exports
- [ ] Sync with server PostgreSQL database
- [ ] Database vacuum/optimization
- [ ] Query performance monitoring
