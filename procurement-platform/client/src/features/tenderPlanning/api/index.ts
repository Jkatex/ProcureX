import { apiClient } from '@/shared/api/http';
import type {
  ProcurementPlan,
  ProcurementPlanningListResponse,
  ProcurementPlanningQuery,
  ProcurementPlanningRecord,
  SaveAnnualProcurementPlanInput
} from '@/features/tenderPlanning/types';

export const tenderPlanningApi = {
  async listPlans(query: ProcurementPlanningQuery = {}) {
    const response = await apiClient.get<ProcurementPlanningListResponse>('/api/procurement/planning', {
      params: query
    });
    return response.data;
  },

  async getSummary(query: ProcurementPlanningQuery = {}) {
    const response = await apiClient.get<ProcurementPlanningListResponse['summary']>('/api/procurement/planning/summary', {
      params: query
    });
    return response.data;
  },

  async saveAnnualPlan(input: SaveAnnualProcurementPlanInput) {
    const response = await apiClient.post<ProcurementPlan>('/api/procurement/planning/annual-plan', serializeAnnualPlan(input));
    return response.data;
  },

  async getPlan(planId: string) {
    const response = await apiClient.get<ProcurementPlan>(`/api/procurement/planning/plans/${planId}`);
    return response.data;
  },

  async updatePlan(planId: string, input: Partial<SaveAnnualProcurementPlanInput>) {
    const response = await apiClient.put<ProcurementPlan>(`/api/procurement/planning/plans/${planId}`, serializeAnnualPlan(input));
    return response.data;
  },

  async createLine(planId: string, input: ProcurementPlanningRecord) {
    const response = await apiClient.post<ProcurementPlanningRecord>(`/api/procurement/planning/plans/${planId}/lines`, toPlanLinePayload(input));
    return response.data;
  },

  async updateLine(lineId: string, input: Partial<ProcurementPlanningRecord>) {
    const response = await apiClient.patch<ProcurementPlanningRecord>(`/api/procurement/planning/lines/${lineId}`, toPlanLinePayload(input));
    return response.data;
  },

  async deleteLine(lineId: string) {
    const response = await apiClient.delete<ProcurementPlanningRecord>(`/api/procurement/planning/lines/${lineId}`);
    return response.data;
  }
};

const planLinePayloadKeys = [
  'tenderTitle',
  'openingDate',
  'closingDate',
  'category',
  'budget',
  'procurementMethod',
  'sourceOfFunds',
  'expectedCompletionDate',
  'status',
  'planState',
  'notes',
  'customValues'
] as const satisfies readonly (keyof ProcurementPlanningRecord)[];

function serializeAnnualPlan(input: Partial<SaveAnnualProcurementPlanInput>) {
  return {
    ...input,
    ...(input.lines ? { lines: input.lines.map(toPlanLinePayload) } : {})
  };
}

function toPlanLinePayload(input: Partial<ProcurementPlanningRecord>) {
  const payload: Partial<Pick<ProcurementPlanningRecord, (typeof planLinePayloadKeys)[number]>> = {};

  for (const key of planLinePayloadKeys) {
    if (input[key] !== undefined) {
      payload[key] = input[key] as never;
    }
  }

  return payload;
}
