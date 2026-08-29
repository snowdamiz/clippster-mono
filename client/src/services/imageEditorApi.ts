import api from './api';

export interface ImageEditorProject {
  id: number;
  name: string;
  project_data: any;
  thumbnail_url?: string;
  canvas_width?: number;
  canvas_height?: number;
  updated_at: string;
  inserted_at: string;
}

export interface ProjectSummary {
  id: number;
  name: string;
  thumbnail_url?: string;
  canvas_width?: number;
  canvas_height?: number;
  updated_at: string;
  inserted_at: string;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await api.get('/image-editor/projects');
  return response.data.projects;
}

export async function createProject(data: {
  name: string;
  project_data: any;
  thumbnail_url?: string;
  canvas_width?: number;
  canvas_height?: number;
}): Promise<ImageEditorProject> {
  const response = await api.post('/image-editor/projects', data);
  return response.data;
}

export async function getProject(id: number): Promise<ImageEditorProject> {
  const response = await api.get(`/image-editor/projects/${id}`);
  return response.data;
}

export async function updateProject(
  id: number,
  data: {
    name?: string;
    project_data?: any;
    thumbnail_url?: string;
    canvas_width?: number;
    canvas_height?: number;
  }
): Promise<ImageEditorProject> {
  const response = await api.put(`/image-editor/projects/${id}`, data);
  return response.data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/image-editor/projects/${id}`);
}
