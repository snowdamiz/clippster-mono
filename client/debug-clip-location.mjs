import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the SQLite database (Tauri app data location)
import fs from 'fs';

const baseDir = join(os.homedir(), 'AppData', 'Roaming', 'com.openworth.clippster');
const prodDbPath = join(baseDir, 'clippster_v25.db');
const devDbPath = join(baseDir, 'clippster_v25_dev.db');

let dbPath;
if (fs.existsSync(devDbPath)) {
  console.log('✓ Using dev database:', devDbPath);
  dbPath = devDbPath;
} else if (fs.existsSync(prodDbPath)) {
  console.log('✓ Using prod database:', prodDbPath);
  dbPath = prodDbPath;
} else {
  console.error('❌ No database found at:');
  console.error('  Dev:', devDbPath);
  console.error('  Prod:', prodDbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Find the most recent clip
console.log('\n=== MOST RECENT CLIP ===');
const recentClip = db.prepare(`
  SELECT id, name, project_id, file_path, created_at 
  FROM clips 
  ORDER BY created_at DESC 
  LIMIT 1
`).get();

if (recentClip) {
  console.log('Clip ID:', recentClip.id);
  console.log('Clip Name:', recentClip.name);
  console.log('Project ID:', recentClip.project_id);
  console.log('File Path:', recentClip.file_path);
  console.log('Created At:', new Date(recentClip.created_at * 1000).toLocaleString());

  // Find the project this clip belongs to
  if (recentClip.project_id) {
    console.log('\n=== PROJECT DETAILS ===');
    const project = db.prepare(`
      SELECT id, name, description, platform, created_at 
      FROM projects 
      WHERE id = ?
    `).get(recentClip.project_id);

    if (project) {
      console.log('Project ID:', project.id);
      console.log('Project Name:', project.name);
      console.log('Project Description:', project.description);
      console.log('Platform:', project.platform);
      console.log('Created At:', new Date(project.created_at * 1000).toLocaleString());
    } else {
      console.log('❌ Project not found! Orphaned clip.');
    }
  } else {
    console.log('❌ Clip has no project_id!');
  }

  // Check how many clips are in this project
  if (recentClip.project_id) {
    console.log('\n=== CLIPS IN THIS PROJECT ===');
    const clipsInProject = db.prepare(`
      SELECT id, name, created_at 
      FROM clips 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `).all(recentClip.project_id);

    console.log(`Total clips in project: ${clipsInProject.length}`);
    clipsInProject.forEach((clip, i) => {
      console.log(`  ${i + 1}. ${clip.name} (${new Date(clip.created_at * 1000).toLocaleString()})`);
    });

    // Check if this project has a parent
    const projectDetails = db.prepare(`
      SELECT id, name, parent_id, user_id 
      FROM projects 
      WHERE id = ?
    `).get(recentClip.project_id);

    if (projectDetails) {
      console.log('\n=== PROJECT HIERARCHY ===');
      console.log('Project ID:', projectDetails.id);
      console.log('Parent ID:', projectDetails.parent_id || 'None (top-level)');
      console.log('User ID:', projectDetails.user_id || 'NULL (unowned)');

      if (projectDetails.parent_id) {
        const parent = db.prepare(`
          SELECT id, name FROM projects WHERE id = ?
        `).get(projectDetails.parent_id);
        if (parent) {
          console.log('Parent Project:', parent.name);
        }
      }
    }
  }
} else {
  console.log('No clips found in database');
}

// List all projects with "asmongold" or "Live" in the name
console.log('\n=== ALL LIVESTREAM PROJECTS ===');
const livestreamProjects = db.prepare(`
  SELECT id, name, platform, created_at,
         (SELECT COUNT(*) FROM clips WHERE project_id = projects.id) as clip_count
  FROM projects 
  WHERE name LIKE '%Live%' OR name LIKE '%asmongold%'
  ORDER BY created_at DESC
  LIMIT 10
`).all();

if (livestreamProjects.length > 0) {
  livestreamProjects.forEach((proj, i) => {
    console.log(`${i + 1}. "${proj.name}" (${proj.platform || 'no platform'})`);
    console.log(`   ID: ${proj.id}`);
    console.log(`   Clips: ${proj.clip_count}`);
    console.log(`   Created: ${new Date(proj.created_at * 1000).toLocaleString()}`);
    console.log('');
  });
} else {
  console.log('No livestream projects found');
}

db.close();
