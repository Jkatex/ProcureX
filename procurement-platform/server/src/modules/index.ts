/* Exports the index ts server module boundary for route registration and cross-module wiring. */
import { createModuleRouter as createIdentityRouter, moduleDefinition as identityDefinition } from './identity/index.js';
import { createModuleRouter as createOrganizationRouter, moduleDefinition as organizationDefinition } from './organization/index.js';
import { createModuleRouter as createProcurementRouter, moduleDefinition as procurementDefinition } from './procurement/index.js';
import { createModuleRouter as createBiddingRouter, moduleDefinition as biddingDefinition } from './bidding/index.js';
import { createModuleRouter as createEvaluationRouter, moduleDefinition as evaluationDefinition } from './evaluation/index.js';
import { createModuleRouter as createAwardContractRouter, moduleDefinition as awardContractDefinition } from './award-contract/index.js';
import { createModuleRouter as createPostAwardRouter, moduleDefinition as postAwardDefinition } from './post-award/index.js';
import { createModuleRouter as createFinancialRouter, moduleDefinition as financialDefinition } from './financial/index.js';
import { createModuleRouter as createComplianceAdminRouter, moduleDefinition as complianceAdminDefinition } from './compliance-admin/index.js';
import { createModuleRouter as createCommunicationRouter, moduleDefinition as communicationDefinition } from './communication/index.js';
import { createModuleRouter as createDashboardRouter, moduleDefinition as dashboardDefinition } from './dashboard/index.js';
import { createModuleRouter as createRecordsRouter, moduleDefinition as recordsDefinition } from './records/index.js';
import { createModuleRouter as createIntelligenceRouter, moduleDefinition as intelligenceDefinition } from './intelligence/index.js';
import { createModuleRouter as createIntegrationRouter, moduleDefinition as integrationDefinition } from './integration/index.js';
import { createModuleRouter as createDocumentsRouter, moduleDefinition as documentsDefinition } from './documents/index.js';
import { createModuleRouter as createPublicRouter, moduleDefinition as publicDefinition } from './public/index.js';
import { createModuleRouter as createSupportRouter, moduleDefinition as supportDefinition } from './support/index.js';
import { createModuleRouter as createHelpCentreRouter, moduleDefinition as helpCentreDefinition } from './help-centre/index.js';
import type { RegisteredModule } from './module-contract.js';

export const registeredModules: RegisteredModule[] = [
  { ...publicDefinition, basePath: '/api/public', router: createPublicRouter() },
  { ...identityDefinition, basePath: '/api/identity', router: createIdentityRouter() },
  { ...organizationDefinition, basePath: '/api/organization', router: createOrganizationRouter() },
  { ...procurementDefinition, basePath: '/api/procurement', router: createProcurementRouter() },
  { ...biddingDefinition, basePath: '/api/bidding', router: createBiddingRouter() },
  { ...evaluationDefinition, basePath: '/api/evaluation', router: createEvaluationRouter() },
  { ...awardContractDefinition, basePath: '/api/award-contract', router: createAwardContractRouter() },
  { ...postAwardDefinition, basePath: '/api/post-award', router: createPostAwardRouter() },
  { ...financialDefinition, basePath: '/api/financial', router: createFinancialRouter() },
  { ...complianceAdminDefinition, basePath: '/api/compliance-admin', router: createComplianceAdminRouter() },
  { ...communicationDefinition, basePath: '/api/communication', router: createCommunicationRouter() },
  { ...dashboardDefinition, basePath: '/api/dashboard', router: createDashboardRouter() },
  { ...recordsDefinition, basePath: '/api/records', router: createRecordsRouter() },
  { ...intelligenceDefinition, basePath: '/api/intelligence', router: createIntelligenceRouter() },
  { ...integrationDefinition, basePath: '/api/integration', router: createIntegrationRouter() },
  { ...documentsDefinition, basePath: '/api/documents', router: createDocumentsRouter() },
  { ...supportDefinition, basePath: '/api/support', router: createSupportRouter() },
  { ...helpCentreDefinition, basePath: '/api/help-centre', router: createHelpCentreRouter() }
];
