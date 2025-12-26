/**
 * API: проекты и этапы проектов.
 *
 * Здесь собраны типы данных (Project/ProjectStage) и функции чтения/создания/обновления.
 * Модуль используется страницами "Проекты" и формами выбора проекта/этапа в закупках.
 */
import { http, fixPath } from './_http';

/* ========= Types ========= */

export type Project = {
  id: number;
  code?: string | null;
  name?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  template?: number | null;
};

export type ProjectStage = {
  id: number;
  project: number;
  name: string;
  order?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  status?: string | null;
};

export type StageTemplateLine = {
  id: number;
  template: number;
  name: string;
  order?: number | null;
};

export type StageTemplate = {
  id: number;
  name: string;
  description?: string | null;
  is_system?: boolean;
  lines?: StageTemplateLine[];
};

/* ========= Helpers ========= */

function unpage<T>(data: any): T {
  return (data && data.results) ? data.results as T : (data as T);
}

/* ========= Projects ========= */

export type ProjectListParams = { search?: string };

export async function fetchProjects(params?: ProjectListParams): Promise<Project[]> {
  const { data } = await http.get(fixPath('/api/projects/projects/'), { params });
  return unpage<Project[]>(data);
}

export type CreateProjectPayload = { code: string; name: string; template?: number | null };
export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await http.post(fixPath('/api/projects/projects/'), payload);
  return data;
}

export async function fetchProject(projectId: number): Promise<Project> {
  const { data } = await http.get(fixPath(`/api/projects/projects/${projectId}/`));
  return data;
}

/* ========= Project Stages ========= */

export async function fetchProjectStages(projectId: number): Promise<ProjectStage[]> {
  try {
    const { data } = await http.get(fixPath(`/api/projects/projects/${projectId}/stages/`));
    return unpage<ProjectStage[]>(data);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 404) {
      const { data } = await http.get(fixPath(`/api/projects/project-stages/?project=${projectId}`));
      return unpage<ProjectStage[]>(data);
    }
    throw e;
  }
}

export type CreateStagePayload = {
  name: string;
  order?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  status?: string | null;
};

export async function createStageNested(projectId: number, payload: CreateStagePayload) {
  const { data } = await http.post(fixPath(`/api/projects/projects/${projectId}/stages/`), payload);
  return data?.stages || data; // nested returns { created, count, stages }
}

export async function createStageWithFallback(projectId: number, payload: CreateStagePayload) {
  try {
    return await createStageNested(projectId, payload);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 404 || status === 405) {
      const body = { project: projectId, ...payload };
      const { data } = await http.post(fixPath(`/api/projects/project-stages/`), body);
      return data;
    }
    throw e;
  }
}

/* ========= Stage Templates (для CreateProjectDialog и др.) ========= */

export type TemplateListParams = { search?: string };

export async function fetchStageTemplates(params?: TemplateListParams): Promise<StageTemplate[]> {
  const { data } = await http.get(fixPath('/api/projects/templates/'), { params });
  return unpage<StageTemplate[]>(data);
}

export async function fetchStageTemplateLines(templateId: number): Promise<StageTemplateLine[]> {
  const { data } = await http.get(fixPath(`/api/projects/templates/${templateId}/lines/`));
  return unpage<StageTemplateLine[]>(data);
}

export type CreateStageTemplatePayload = { name: string; description?: string; is_system?: boolean };
export async function createStageTemplate(payload: CreateStageTemplatePayload): Promise<StageTemplate> {
  const { data } = await http.post(fixPath('/api/projects/templates/'), payload);
  return data;
}

export type CreateStageTemplateLinePayload = { template: number; name: string; order?: number };
export async function createStageTemplateLine(payload: CreateStageTemplateLinePayload): Promise<StageTemplateLine> {
  const { data } = await http.post(fixPath('/api/projects/template-lines/'), payload);
  return data;
}

/* ========= Actions on Project with Templates ========= */

export type ApplyTemplatePayload = { template_id?: number; replace?: boolean; renumber_from?: number };
export async function applyTemplateToProject(projectId: number, payload: ApplyTemplatePayload) {
  const { data } = await http.post(fixPath(`/api/projects/projects/${projectId}/apply_template/`), payload);
  return data;
}

export type SaveAsTemplatePayload = { name: string; description?: string; is_system?: boolean };
export async function saveProjectStagesAsTemplate(projectId: number, payload: SaveAsTemplatePayload) {
  const { data } = await http.post(fixPath(`/api/projects/projects/${projectId}/save_as_template/`), payload);
  return data;
}
