/**
 * Дополнительные API-хелперы для управления этапами проекта (ProjectStage).
 *
 * Эти функции вынесены отдельно от `api/projects.ts`, чтобы не перегружать основной модуль
 * и держать узкоспециализированные операции (update/delete/reorder) рядом.
 */
import { http, fixPath } from './_http';

// --- Extra helpers for stage editing/reordering ---
export type UpdateStagePayload = {
  name?: string;
  order?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  status?: string | null;
};

export async function updateStage(stageId: number, payload: UpdateStagePayload) {
  const { data } = await http.patch(fixPath(`/api/projects/stages/${stageId}/`), payload);
  // сервер возвращает { updated, stages } — вернём stages если есть
  return data?.stages || data;
}

export async function deleteStage(stageId: number) {
  const { data } = await http.delete(fixPath(`/api/projects/stages/${stageId}/`));
  return data?.stages || data;
}

export async function reorderProjectStages(projectId: number, ids: number[]) {
  const { data } = await http.post(fixPath(`/api/projects/projects/${projectId}/stages/reorder/`), { ids });
  return data?.stages || data;
}
