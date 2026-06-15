import { ModuleRepository } from './repository.js';
import {
  moduleDefinition,
  type AwardContractRequestContext,
  type AwardDecisionInput,
  type AwardNoticeResponseInput,
  type AwardRecommendationQuery,
  type ContractMilestoneEvidenceInput,
  type ContractMilestoneInput,
  type ContractMilestonePatchInput,
  type ContractQuery,
  type ContractSignatureRequestInput,
  type ContractSignatureSignInput,
  type ContractStatusPatchInput,
  type ContractVersionInput,
  type ModuleStatus
} from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  listRecommendations(query: AwardRecommendationQuery, context: AwardContractRequestContext) {
    return this.repository.listRecommendations(query, context);
  }

  async recommendation(id: string, context: AwardContractRequestContext) {
    const recommendation = await this.repository.getRecommendation(id, context);
    if (!recommendation) throw requestError('Award recommendation was not found.', 404);
    return recommendation;
  }

  async approveRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.approveRecommendation(id, input, context);
    if (!recommendation) throw requestError('Award recommendation was not found after approval.', 404);
    return recommendation;
  }

  async returnRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.returnRecommendation(id, input, context);
    if (!recommendation) throw requestError('Award recommendation was not found after return.', 404);
    return recommendation;
  }

  async respondToNotice(id: string, input: AwardNoticeResponseInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.respondToNotice(id, input, context);
    if (!recommendation) throw requestError('Award notice was not found after response.', 404);
    return recommendation;
  }

  listContracts(query: ContractQuery, context: AwardContractRequestContext) {
    return this.repository.listContracts(query, context);
  }

  async contract(id: string, context: AwardContractRequestContext) {
    const contract = await this.repository.getContract(id, context);
    if (!contract) throw requestError('Contract was not found.', 404);
    return contract;
  }

  async createContractVersion(id: string, input: ContractVersionInput, context: AwardContractRequestContext) {
    const contract = await this.repository.createContractVersion(id, input, context);
    if (!contract) throw requestError('Contract was not found after version creation.', 404);
    return contract;
  }

  async createSignatureRequests(id: string, input: ContractSignatureRequestInput, context: AwardContractRequestContext) {
    const contract = await this.repository.createSignatureRequests(id, input, context);
    if (!contract) throw requestError('Contract was not found after signature request.', 404);
    return contract;
  }

  async signContractSignature(contractId: string, signatureId: string, input: ContractSignatureSignInput, context: AwardContractRequestContext) {
    const contract = await this.repository.signContractSignature(contractId, signatureId, input, context);
    if (!contract) throw requestError('Contract was not found after signing.', 404);
    return contract;
  }

  async createMilestone(contractId: string, input: ContractMilestoneInput, context: AwardContractRequestContext) {
    const contract = await this.repository.createMilestone(contractId, input, context);
    if (!contract) throw requestError('Contract was not found after milestone creation.', 404);
    return contract;
  }

  async updateMilestone(contractId: string, milestoneId: string, input: ContractMilestonePatchInput, context: AwardContractRequestContext) {
    const contract = await this.repository.updateMilestone(contractId, milestoneId, input, context);
    if (!contract) throw requestError('Contract was not found after milestone update.', 404);
    return contract;
  }

  async addMilestoneEvidence(contractId: string, milestoneId: string, input: ContractMilestoneEvidenceInput, context: AwardContractRequestContext) {
    const contract = await this.repository.addMilestoneEvidence(contractId, milestoneId, input, context);
    if (!contract) throw requestError('Contract was not found after evidence update.', 404);
    return contract;
  }

  async updateContractStatus(contractId: string, input: ContractStatusPatchInput, context: AwardContractRequestContext) {
    const contract = await this.repository.updateContractStatus(contractId, input, context);
    if (!contract) throw requestError('Contract was not found after status update.', 404);
    return contract;
  }
}
