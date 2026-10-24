import { inject, provide, type InjectionKey } from 'vue';
import type { AIVideoProject } from './useAIVideoProject';

const PROJECT_KEY: InjectionKey<AIVideoProject> = Symbol('ai-video-project');

export function provideProject(project: AIVideoProject) {
  provide(PROJECT_KEY, project);
}

/** The open project, provided by the AI video page. */
export function useProject(): AIVideoProject {
  const project = inject(PROJECT_KEY);
  if (!project) throw new Error('useProject() needs the AI video page to provide a project.');
  return project;
}
