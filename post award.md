You are reviewing the existing ProcureX procurement platform. I want you to deeply analyze the current Awarding and Contracts application and give architectural and implementation suggestions for a complete Post-Award Procurement Management module.
Do not immediately rewrite the whole application. First inspect the current frontend, backend, Prisma database schema, routes, services, workflows, status enums, dashboards, existing awarding flows, contract formation flows, invoicing, payments, performance management, communication center, records/history, notifications, and any existing post-award implementation.
The goal is to determine what already exists, what is incomplete, what is only mocked in the frontend, what is implemented in the backend but not connected to the frontend, what database models already support post-award, and what new implementation is genuinely required.
ProcureX is an end-to-end B2B procurement platform supporting:
•	Goods
•	Works
•	Non-Consultancy Services
•	Consultancy Services
Post-award workflows must not be identical for all procurement types.
The post-award system should manage the entire lifecycle after a contract has been signed and activated until final contract closure.
The intended overall lifecycle is:
Tender
→ Bidding
→ Evaluation
→ Award Recommendation
→ Award Decision
→ Award Notice
→ Supplier Response
→ Contract Negotiation
→ Contract Finalization
→ Contract Signing
→ Contract Activation
→ Post-Award Implementation
→ Inspection and Acceptance
→ Invoice and Payment
→ Performance Evaluation
→ Completion
→ Warranty or Defects Period where applicable
→ Final Contract Closure
→ Records and Performance History
Please review the current codebase and suggest how the ProcureX Post-Award module should be designed and implemented.
1. SEPARATE CONTRACT FORMATION FROM POST-AWARD
First determine whether the existing system clearly separates:
Awarding
•	Award recommendation
•	Award approval
•	Standstill
•	Award notices
•	Supplier award response
Contract Formation
•	Contract drafting
•	Negotiation
•	Contract terms
•	Performance security requirements
•	Signing
•	Effective date
•	Commencement date
•	Contract activation
Post-Award
•	Implementation
•	Deliveries
•	Milestones
•	Progress
•	Inspections
•	Acceptance
•	Invoices
•	Payments
•	Variations
•	Risks
•	Issues
•	Claims
•	Disputes
•	Performance
•	Completion
•	Warranty
•	Closure
Suggest how these stages should be clearly separated in the architecture, navigation, workflow states, backend services, and database.
________________________________________
2. CONTRACT ACTIVATION
After both parties have signed the contract, do not immediately treat the contract as fully operational without checks.
Suggest a Contract Activation workflow.
Possible activation requirements should include:
•	Fully signed contract
•	Required schedules and annexes
•	Final specifications
•	Final BOQ or price schedule
•	Final terms of reference
•	Final implementation schedule
•	Performance security
•	Advance payment guarantee where required
•	Insurance documents
•	Contract manager assignment
•	Supplier representative assignment
•	Effective date
•	Commencement date
•	Planned completion date
•	Kick-off requirements
Suggest whether ProcureX should have statuses such as:
DRAFT
NEGOTIATING
AWAITING_SIGNATURE
PARTIALLY_SIGNED
SIGNED
PENDING_ACTIVATION
ACTIVE
SUSPENDED
AT_RISK
SUBSTANTIALLY_COMPLETED
COMPLETED
IN_WARRANTY
CLOSING
CLOSED
TERMINATED
CANCELLED
Review the existing enums and recommend what should be retained, changed, or added.
________________________________________
3. CONTRACT MANAGEMENT PLAN
Suggest implementing a Contract Management Plan automatically generated from:
•	Tender requirements
•	Winning bid commitments
•	Evaluation outcome
•	Negotiated contract terms
•	Signed contract
The Contract Management Plan should define:
•	Contract objectives
•	Contract value
•	Original contract value
•	Current contract value
•	Start date
•	Completion date
•	Responsible persons
•	Milestones
•	Deliverables
•	Payment schedule
•	Acceptance requirements
•	Required evidence
•	Risks
•	KPIs
•	Reporting requirements
•	Communication procedures
•	Escalation procedures
•	Change management procedures
Explain how this should fit into the current ProcureX architecture.
________________________________________
4. CENTRAL POST-AWARD DESIGN PRINCIPLE
The Post-Award system should not become only a document upload area.
The core business chain should be:
CONTRACT OBLIGATION
→ MILESTONE / DELIVERY / SERVICE PERIOD
→ EVIDENCE
→ INSPECTION OR REVIEW
→ ACCEPTANCE
→ INVOICE
→ PAYMENT
→ PERFORMANCE RECORD
Suggest how ProcureX should implement this relationship.
Every payment should ideally trace back to something that was contractually required, delivered, verified, and accepted.
Review whether the existing models already support this traceability.
________________________________________
5. CONTRACT WORKSPACE
Suggest a complete Contract Implementation Workspace for every active contract.
Possible sections:
1.	Overview
2.	Contract Management Plan
3.	Implementation Plan
4.	Milestones and Deliverables
5.	Progress
6.	Deliveries
7.	Inspections and Acceptance
8.	Invoices and Payments
9.	Variations and Amendments
10.	Risks and Issues
11.	Claims and Disputes
12.	Performance
13.	Communication
14.	Meetings and Actions
15.	Guarantees and Insurance
16.	Warranty and Defects
17.	Audit Trail
18.	Closeout
Review the current frontend and recommend how this should integrate into the existing Awarding and Contracts application without unnecessarily duplicating pages.
________________________________________
6. GOODS POST-AWARD WORKFLOW
Goods should have a dedicated workflow such as:
Contract Activated
→ Delivery Schedule
→ Supplier Dispatch Notice
→ Goods Delivery
→ Goods Receipt
→ Inspection
→ Acceptance / Partial Acceptance / Rejection
→ Invoice
→ Three-Way Match
→ Payment
→ Warranty
→ Closure
Suggest implementation for:
Delivery Schedule
•	Item
•	Quantity
•	Delivery date
•	Delivery location
•	Batch
•	Milestone
Dispatch Notice
•	Carrier
•	Vehicle
•	Driver
•	Dispatch date
•	Expected arrival
•	Packing list
•	Delivery note
•	Tracking reference
Goods Receipt
•	Quantity ordered
•	Quantity delivered
•	Quantity received
•	Quantity damaged
•	Quantity rejected
•	Quantity accepted
Inspection
Possible outcomes:
PASSED
FAILED
PARTIAL_ACCEPTANCE
REINSPECTION_REQUIRED
Acceptance
Possible statuses:
PENDING
ACCEPTED
PARTIALLY_ACCEPTED
CONDITIONALLY_ACCEPTED
REJECTED
Delivery must not automatically mean acceptance.
Review whether existing Goods workflows or database models can be reused.
________________________________________
7. WORKS POST-AWARD WORKFLOW
Works require a much deeper workflow.
Suggested lifecycle:
Contract Activated
→ Site Handover
→ Mobilization
→ Work Programme
→ Construction Progress
→ Site Inspections
→ Measurements
→ Interim Payment Certificates
→ Variations and Claims
→ Practical Completion
→ Defects Liability Period
→ Final Completion
→ Final Account
→ Closure
Suggest implementation for:
Site Handover
•	Possession date
•	Site conditions
•	Access
•	Handover documents
•	Site photos
•	Issues identified
Mobilization
•	Personnel
•	Equipment
•	Temporary facilities
•	Insurance
•	Performance security
•	Construction programme
•	Health and safety plan
•	Environmental plan
Progress Reporting
•	Work completed
•	Percentage completion
•	Labour
•	Equipment
•	Materials
•	Photos
•	Delays
•	Safety incidents
•	Weather impact
BOQ Measurement
•	BOQ item
•	Contract quantity
•	Previous quantity
•	Current quantity
•	Cumulative quantity
•	Remaining quantity
•	Rate
•	Certified amount
Interim Payment Certificate
Contractor valuation
→ Measurement verification
→ Supervisor review
→ Buyer review
→ Certificate issuance
→ Invoice
→ Payment approval
→ Payment
Practical Completion
•	Completion certificate
•	Outstanding works
•	Defects list
•	Retention status
Defects Liability
•	Defect
•	Date reported
•	Severity
•	Responsible party
•	Correction deadline
•	Evidence
•	Reinspection
•	Resolution
Review whether current ProcureX implementation has any of these features already.
________________________________________
8. NON-CONSULTANCY SERVICES POST-AWARD
Suggested workflow:
Contract Activated
→ Service Commencement
→ Service Delivery
→ SLA Monitoring
→ Periodic Service Reports
→ Performance Verification
→ Invoice
→ Payment
→ Performance Review
→ Renewal or Completion
Suggest support for:
•	SLA definitions
•	Availability
•	Response time
•	Resolution time
•	Service quality
•	Missed service events
•	Incidents
•	Complaints
•	Scheduled maintenance
•	Service credits
•	Penalties where contractually applicable
Review how this should map to the existing internal services workflow used for Non-Consultancy procurement.
________________________________________
9. CONSULTANCY POST-AWARD
Consultancy should be primarily deliverable-based.
Suggested workflow:
Contract Activated
→ Inception
→ Deliverable Submission
→ Technical Review
→ Comments
→ Revision
→ Approval
→ Payment
→ Next Deliverable
→ Final Report
→ Closure
Possible deliverables:
•	Inception Report
•	Situation Analysis
•	Design Report
•	Draft Report
•	Training
•	Final Report
•	Source Files
•	Knowledge Transfer
Implement version control:
Deliverable v1
→ Reviewed
→ Revision requested
→ v2
→ Approved
Do not overwrite previous submissions.
Suggest the best database and backend design for deliverable versioning and review history.
________________________________________
10. EVIDENCE-BASED COMPLETION
ProcureX should not allow users to mark important contractual obligations as complete without supporting evidence where evidence is required.
Every obligation or milestone may define:
•	Required evidence
•	Evidence type
•	Acceptance method
•	Acceptance criteria
•	Responsible reviewer
Examples:
Goods
•	Delivery note
•	Serial numbers
•	Photos
•	Inspection result
Works
•	Measurement sheet
•	Progress photos
•	Engineer certification
•	Test result
Services
•	Service report
•	Attendance
•	Logs
•	SLA report
Consultancy
•	Report
•	Design
•	Dataset
•	Source code
•	Training evidence
Suggest a flexible schema so evidence requirements can depend on the contract and procurement type.
________________________________________
11. INSPECTION AND ACCEPTANCE
Suggest a dedicated Inspection and Acceptance capability.
Workflow:
Supplier requests inspection where applicable
→ Buyer schedules inspection
→ Inspection conducted
→ Findings recorded
→ Pass / Fail / Partial
→ Corrective action if required
→ Reinspection
→ Acceptance certificate
Possible inspection fields:
•	Inspection ID
•	Contract
•	Related milestone
•	Related delivery
•	Inspection type
•	Inspector
•	Date
•	Location
•	Checklist
•	Findings
•	Non-conformities
•	Attachments
•	Photos
•	Result
Explain whether inspection should be implemented as a general reusable engine that can support Goods, Works, Services, and Consultancy.
________________________________________
12. NON-CONFORMANCE AND CORRECTIVE ACTION
Suggest implementation of:
NON-CONFORMANCE REPORT
Workflow:
Issue detected
→ Non-conformance raised
→ Supplier notified
→ Corrective action proposed
→ Buyer reviews
→ Correction performed
→ Reinspection
→ Closed
Fields may include:
•	Description
•	Related requirement
•	Severity
•	Responsible party
•	Correction deadline
•	Supplier response
•	Corrective action
•	Verification
•	Closure status
Explain how this should connect to supplier performance scoring.
________________________________________
13. INVOICES AND THREE-WAY MATCHING
Invoices should not exist independently from contract execution.
An invoice should reference where applicable:
•	Contract
•	Milestone
•	Delivery
•	Goods receipt
•	Acceptance certificate
•	Interim payment certificate
•	Service period
•	Consultancy deliverable
For Goods, implement three-way matching:
CONTRACT / PURCHASE ORDER
+
GOODS RECEIPT / ACCEPTANCE
+
INVOICE
PAYMENT ELIGIBILITY
Possible matching statuses:
MATCHED
PARTIAL_MATCH
QUANTITY_MISMATCH
PRICE_MISMATCH
DUPLICATE_INVOICE
MISSING_ACCEPTANCE
OVER_CONTRACT_VALUE
Review the existing invoice and payment implementation and recommend what should be extended rather than duplicated.
________________________________________
14. PAYMENT MANAGEMENT
Suggested workflow:
Invoice Submitted
→ Invoice Verified
→ Payment Recommended
→ Payment Approved
→ Payment Initiated
→ Payment Completed
→ Supplier Confirms Receipt
Track:
•	Invoice amount
•	Approved amount
•	Tax
•	Retention
•	Penalty
•	Advance recovery
•	Other deductions
•	Net payable
•	Payment date
•	Transaction reference
ProcureX may track payments even when actual payment is processed by another financial system.
Suggest how external payment integrations could later be added without tightly coupling them to the core contract module.
________________________________________
15. ADVANCE PAYMENT AND RETENTION
Suggest support for:
Advance Payment
•	Advance amount
•	Advance percentage
•	Advance payment guarantee
•	Amount recovered
•	Outstanding balance
•	Recovery schedule
Retention
•	Retention rate
•	Retention cap
•	Amount retained
•	Amount released
•	Remaining retention
•	Release conditions
These features are particularly important for Works contracts.
________________________________________
16. CONTRACT VARIATIONS AND AMENDMENTS
The signed contract must not be directly edited.
Changes should happen through controlled records such as:
•	Variation
•	Amendment
•	Addendum
•	Extension
•	Change Order
Suggested workflow:
Variation Requested
→ Reason
→ Scope impact
→ Cost impact
→ Time impact
→ Technical review
→ Budget review
→ Approval
→ Supplier agreement
→ Signed amendment
→ Updated current baseline
Always preserve:
•	Original contract value
•	Original completion date
•	Original scope
Also maintain:
•	Approved variations
•	Current contract value
•	Approved extensions
•	Current completion date
Suggest how to implement immutable contract baselines and versioned amendments.
________________________________________
17. EXTENSION OF TIME
Suggested fields:
•	Reason
•	Event date
•	Days requested
•	Supporting evidence
•	Impact
•	Mitigation actions
Workflow:
Extension Requested
→ Reviewed
→ Approved / Partially Approved / Rejected
→ Current completion date recalculated
Explain how extensions should interact with delay calculations and liquidated damages.
________________________________________
18. DELAYS AND LIQUIDATED DAMAGES
ProcureX should detect potential delay where:
Current date is past contractual due date
AND
Required completion has not been achieved
AND
There is no approved extension covering the delay
The system may calculate potential liquidated damages from the contract rules but should not automatically impose the deduction without authorized review.
Suggest implementation for:
•	Delay days
•	Excusable delay
•	Non-excusable delay
•	Approved extension
•	Potential liquidated damages
•	Approved liquidated damages
•	Deduction from payment
________________________________________
19. RISK MANAGEMENT
Every active contract should have a risk register.
Fields:
•	Risk
•	Probability
•	Impact
•	Risk score
•	Owner
•	Mitigation
•	Due date
•	Status
Possible health levels:
LOW
MEDIUM
HIGH
CRITICAL
ProcureX already has or plans an AI/ML risk layer. Suggest how contract risk data should later support:
•	Delay prediction
•	Cost overrun prediction
•	Supplier failure risk
•	Abnormal variation detection
•	Performance deterioration
Do not implement fake AI. First build reliable structured operational data.
________________________________________
20. ISSUE MANAGEMENT
Separate risks from issues.
Risk = may happen.
Issue = has already happened.
Issue fields:
•	Issue
•	Date raised
•	Severity
•	Related milestone
•	Responsible party
•	Action required
•	Deadline
•	Status
Suggest how issues should escalate where appropriate into:
•	Non-conformance
•	Claim
•	Dispute
•	Default
•	Termination process
________________________________________
21. CLAIMS MANAGEMENT
Claims should support both buyer and supplier.
Examples:
Supplier:
•	Buyer delayed site access
•	Supplier requests time and cost
Buyer:
•	Supplier delivered defective goods
•	Buyer requests replacement or compensation
Suggested workflow:
Claim Raised
→ Evidence Submitted
→ Other Party Responds
→ Assessment
→ Negotiation
→ Determination
→ Accepted / Rejected / Settled
Suggest the correct data model and audit trail.
________________________________________
22. DISPUTE MANAGEMENT
Do not treat every issue as a dispute.
Suggested escalation:
ISSUE
→ FORMAL NOTICE
→ CLAIM
→ NEGOTIATION
→ MEDIATION / ADJUDICATION
→ ARBITRATION / LEGAL PROCESS
ProcureX should record and manage the internal workflow but should not pretend to replace courts, arbitrators, or external authorities.
Suggest a flexible dispute record.
________________________________________
23. CONTRACT COMMUNICATION
Integrate post-award communication with the existing Communication Center.
Messages should be linkable to:
•	Tender
•	Award
•	Contract
•	Milestone
•	Delivery
•	Inspection
•	Invoice
•	Variation
•	Claim
•	Dispute
Support communication types such as:
ORDINARY_MESSAGE
FORMAL_NOTICE
NOTICE_TO_CORRECT
NOTICE_OF_DELAY
NOTICE_OF_DEFAULT
VARIATION_NOTICE
TERMINATION_NOTICE
Formal notices should record:
•	Sent date
•	Received date
•	Acknowledgement
•	Attachments
•	Related contract event
Suggest how to reuse the existing messaging system rather than creating a separate duplicate communication module.
________________________________________
24. MEETINGS AND ACTION ITEMS
Support:
•	Kick-Off Meeting
•	Progress Meeting
•	Technical Meeting
•	Site Meeting
•	Performance Review
•	Dispute Meeting
•	Closeout Meeting
Each meeting may contain:
•	Date
•	Participants
•	Agenda
•	Minutes
•	Decisions
•	Action items
•	Responsible person
•	Due date
Action items should become trackable tasks.
________________________________________
25. PERFORMANCE MANAGEMENT
Implement supplier performance based on actual contract execution data.
Possible dimensions:
Time
•	On-time delivery
•	Milestone delays
Quality
•	Inspection failure
•	Defects
•	Rework
•	Acceptance rate
Commercial
•	Invoice accuracy
•	Variation frequency
Communication
•	Responsiveness
•	Reporting quality
Compliance
•	Insurance
•	Guarantees
•	Required documents
•	Safety
•	Contract obligations
Do not rely only on manual star ratings.
Suggest a scorecard model combining:
•	System-calculated metrics
•	Authorized evaluator assessment
Also consider objective buyer performance indicators such as:
•	Invoice approval time
•	Payment delay
•	Response time
•	Instruction delays
________________________________________
26. GUARANTEES AND INSURANCE
Suggest a dedicated register for:
•	Performance Security
•	Advance Payment Guarantee
•	Retention Guarantee
•	Warranty Guarantee
•	Insurance Policies
Fields:
•	Type
•	Issuer
•	Reference
•	Amount
•	Issue date
•	Expiry date
•	Verification status
•	Document
Generate alerts before expiry.
________________________________________
27. WARRANTY AND DEFECTS
For Goods:
Delivery
→ Acceptance
→ Warranty
→ Final Closure
For Works:
Practical Completion
→ Defects Liability
→ Final Completion
→ Final Certificate
→ Closure
Track:
•	Asset or work item
•	Warranty start
•	Warranty end
•	Issue
•	Repair
•	Replacement
•	Resolution
•	Evidence
________________________________________
28. CONTRACT COMPLETION AND CLOSEOUT
Do not allow a contract to be closed with a single button.
Implement a Closeout Wizard.
Possible stages:
Deliverables
•	All milestones completed
•	Deliverables accepted
•	Outstanding issues resolved
Financial
•	All invoices processed
•	Advance recovered
•	Retention resolved
•	Final payment completed
Contractual
•	Variations finalized
•	Claims resolved
•	Guarantees released
Performance
•	Supplier evaluated
•	Relevant buyer metrics recorded
Documentation
•	Completion certificate
•	Final account
•	Final report
•	Lessons learned
Recommended progression:
ACTIVE
→ SUBSTANTIALLY_COMPLETED
→ COMPLETED
→ IN_WARRANTY or DEFECTS_PERIOD
→ CLOSING
→ CLOSED
________________________________________
29. TERMINATION
Suggest a controlled termination workflow:
Termination Proposed
→ Grounds Recorded
→ Evidence
→ Notice
→ Opportunity to Remedy where applicable
→ Review
→ Approval
→ Termination Notice
→ Financial Settlement
→ Asset / Document Handover
→ Closed as Terminated
Possible reasons:
DEFAULT
MATERIAL_BREACH
INSOLVENCY
FRAUD
PROLONGED_FORCE_MAJEURE
CONVENIENCE
MUTUAL_AGREEMENT
________________________________________
30. DASHBOARD DESIGN
Review the current Awarding and Contracts dashboard:
•	My Urgent Actions
•	Awarding in Progress
•	Awards Received
•	Contracts in Progress
•	Active Contracts
•	Closed Contracts
Suggest how Post-Award should fit into this without unnecessary dashboard duplication.
For Active Contracts, consider:
•	Active contract count
•	Total active contract value
•	Contracts at risk
•	Overdue milestones
•	Pending inspections
•	Invoices awaiting action
•	Expiring guarantees
•	Contracts approaching completion
Each contract should have a health summary:
•	Time
•	Cost
•	Quality
•	Risk
•	Payment
•	Overall health
________________________________________
31. MY URGENT ACTIONS
Make this role-aware and event-driven.
Examples:
•	Milestone overdue
•	Performance security expiring
•	Invoice awaiting approval
•	Inspection scheduled
•	Variation awaiting decision
•	Revised consultancy deliverable submitted
•	SLA breached
•	Corrective action overdue
•	Warranty issue unresolved
Review the current urgent action implementation and suggest how to generate actions from real backend workflow state rather than static frontend data.
________________________________________
32. ORGANIZATION USERS AND RESPONSIBILITY
ProcureX currently follows a one-company account concept.
Keep one Organization entity per company, but review whether the architecture should eventually allow multiple authorized organization members.
Examples:
•	Organization Admin
•	Procurement
•	Contract Manager
•	Finance
•	Inspector
•	Project Manager
•	Authorized Signatory
Do not make this the first required implementation if it would significantly disrupt the current platform.
However, important actions should already be designed with fields such as:
•	performedByUserId
•	organizationId
•	role or responsibility context
•	timestamp
This is important for future auditability.
________________________________________
33. DATABASE REVIEW
Before creating new models, inspect all existing Prisma models.
Identify:
1.	Models that already support Post-Award
2.	Models that can be extended
3.	Models that overlap or duplicate proposed concepts
4.	Missing relationships
5.	Missing indexes
6.	Missing enums
7.	Missing audit fields
8.	Weak cascade or deletion behavior
9.	Areas where signed or approved records should be immutable
Potential conceptual models may include:
Contract
ContractParty
ContractManager
ContractManagementPlan
ContractMilestone
ContractDeliverable
DeliverableSubmission
DeliverableReview
Delivery
DeliveryItem
GoodsReceipt
Inspection
InspectionItem
AcceptanceCertificate
ProgressReport
SiteReport
WorkMeasurement
ServicePerformance
SLA
SLAMeasurement
Invoice
InvoiceItem
InvoiceMatch
Payment
PaymentAllocation
Variation
ContractAmendment
ExtensionOfTime
ContractRisk
ContractIssue
NonConformance
CorrectiveAction
ContractClaim
ContractDispute
PerformanceSecurity
ContractInsurance
ContractMeeting
MeetingAction
ContractPerformanceReview
Warranty
Defect
CompletionCertificate
ContractCloseout
ContractEvent
ContractAuditLog
Do not automatically create all of these as separate tables.
First determine where generic models, subtype models, or JSON metadata are appropriate.
Avoid both extremes:
•	One giant unmaintainable Contract table
•	Hundreds of unnecessary tiny tables
Recommend the best normalized structure for the current codebase.
________________________________________
34. BACKEND ARCHITECTURE
Review whether Post-Award should be:
•	One large contracts service
•	Multiple domain services
•	A modular monolith under contracts/post-award
•	Separate services for invoices, inspections, payments, etc.
Prefer consistency with the existing Node.js/Express architecture.
Possible domains:
•	Contract Core
•	Contract Activation
•	Performance / Milestones
•	Delivery
•	Inspection and Acceptance
•	Financial Management
•	Change Control
•	Risk and Issues
•	Claims and Disputes
•	Performance Evaluation
•	Warranty and Closeout
Suggest the cleanest structure based on the actual repository.
________________________________________
35. API DESIGN
Review existing routes before suggesting new ones.
Possible structure:
/api/contracts/:contractId/activation
/api/contracts/:contractId/management-plan
/api/contracts/:contractId/milestones
/api/contracts/:contractId/deliverables
/api/contracts/:contractId/progress
/api/contracts/:contractId/deliveries
/api/contracts/:contractId/inspections
/api/contracts/:contractId/acceptances
/api/contracts/:contractId/invoices
/api/contracts/:contractId/payments
/api/contracts/:contractId/variations
/api/contracts/:contractId/extensions
/api/contracts/:contractId/risks
/api/contracts/:contractId/issues
/api/contracts/:contractId/non-conformances
/api/contracts/:contractId/claims
/api/contracts/:contractId/disputes
/api/contracts/:contractId/performance
/api/contracts/:contractId/warranties
/api/contracts/:contractId/defects
/api/contracts/:contractId/closeout
Possible commands:
POST /milestones/:id/submit
POST /milestones/:id/accept
POST /milestones/:id/reject
POST /deliveries/:id/dispatch
POST /deliveries/:id/receive
POST /inspections/:id/complete
POST /invoices/:id/match
POST /invoices/:id/approve
POST /variations/:id/approve
POST /contracts/:id/complete
POST /contracts/:id/close
POST /contracts/:id/terminate
Do not create routes that duplicate existing APIs.
________________________________________
36. AUDIT TRAIL
Every important event should create an immutable business event.
Examples:
•	Contract signed
•	Contract activated
•	Delivery submitted
•	Delivery received
•	Inspection completed
•	Acceptance issued
•	Non-conformance raised
•	Invoice submitted
•	Match failed
•	Payment approved
•	Variation approved
•	Extension approved
•	Claim raised
•	Contract completed
•	Contract closed
Corrections should create new events instead of deleting previous history.
Review any current audit log implementation and recommend how Post-Award should use it.
________________________________________
37. NOTIFICATIONS
Review the existing notification system.
Suggest event-driven notifications for:
•	Upcoming milestone
•	Overdue milestone
•	New delivery
•	Inspection request
•	Inspection result
•	Rejected delivery
•	Non-conformance
•	Corrective action overdue
•	Invoice submitted
•	Invoice mismatch
•	Payment approved
•	Variation submitted
•	Extension decision
•	Guarantee expiry
•	Warranty expiry
•	Contract approaching completion
•	Contract closure action required
Avoid duplicating notification logic inside every controller.
________________________________________
38. FRONTEND IMPLEMENTATION
Review the current React architecture.
Identify:
•	Existing reusable components
•	Existing schema-driven forms
•	Existing custom workflow components
•	Existing dashboard cards
•	Existing tables
•	Existing status badges
•	Existing timeline components
•	Existing document upload components
•	Existing approval components
Suggest where schema-driven rendering is appropriate and where custom UI is necessary.
For example:
Schema-driven UI may be suitable for:
•	Risk registers
•	Basic issue records
•	Simple forms
•	Configurable milestone metadata
Custom UI may be necessary for:
•	Works BOQ measurement
•	Three-way matching
•	Contract health dashboard
•	Delivery and goods receipt reconciliation
•	Consultancy deliverable review
•	Variation impact comparison
•	Closeout wizard
Do not replace working custom UI unnecessarily.
________________________________________
39. PROCUREMENT-TYPE-SPECIFIC BEHAVIOR
The Post-Award module should use a common core with specialized workflows.
Common core:
•	Contract
•	Parties
•	Milestones
•	Documents
•	Communication
•	Risks
•	Issues
•	Audit
•	Payments
•	Performance
•	Closeout
Specialized implementations:
Goods
•	Delivery
•	Receipt
•	Inspection
•	Acceptance
•	Warranty
Works
•	Site handover
•	Mobilization
•	Progress
•	BOQ measurement
•	Interim certificates
•	Retention
•	Defects
Services
•	SLA
•	Periodic performance
•	Service reports
•	Service credits
Consultancy
•	Deliverables
•	Versioned submissions
•	Review
•	Revision
•	Approval
Suggest the cleanest implementation pattern.
Do not create four completely separate duplicated Post-Award systems.
________________________________________
40. IMPLEMENTATION PRIORITY
After reviewing the actual code, propose a phased implementation plan.
Suggested priority:
Phase 1 — Core Post-Award Foundation
•	Contract activation
•	Contract workspace
•	Contract state machine
•	Contract management plan
•	Milestones
•	Deliverables
•	Audit events
•	Notifications
Phase 2 — Procurement-Type Execution
•	Goods deliveries and receipt
•	Works progress and measurements
•	Service SLA
•	Consultancy deliverable review
Phase 3 — Inspection and Acceptance
•	Inspection
•	Acceptance
•	Non-conformance
•	Corrective action
Phase 4 — Financial Execution
•	Invoice linking
•	Three-way matching
•	Payment workflow
•	Advance recovery
•	Retention
Phase 5 — Contract Change and Exceptions
•	Variations
•	Amendments
•	Extensions
•	Risks
•	Issues
•	Claims
•	Disputes
Phase 6 — Completion
•	Performance evaluation
•	Warranty
•	Defects
•	Completion
•	Closeout
•	Termination
Adjust this plan based on what already exists.
________________________________________
41. IMPORTANT DEVELOPMENT RULES
While reviewing and suggesting:
1.	Do not invent implementation that already exists.
2.	Do not duplicate existing models, services, routes, components, or workflows.
3.	Clearly distinguish:
o	Fully implemented
o	Partially implemented
o	Frontend-only mock
o	Backend-only
o	Database-only
o	Missing
4.	Preserve existing working architecture where reasonable.
5.	Prefer extending existing modules over rebuilding everything.
6.	Keep frontend, backend, and Prisma models aligned.
7.	Preserve traceability between:
Tender
→ Bid
→ Award
→ Contract
→ Obligation
→ Execution
→ Acceptance
→ Invoice
→ Payment
→ Performance
8.	Avoid placeholder implementation.
9.	Avoid static fake dashboard counts.
10.	Do not implement fake AI.
11.	Protect signed contracts and approved records from direct mutation.
12.	Ensure all important actions are auditable.
13.	Use transactions for sensitive multi-step operations.
14.	Add authorization checks for buyer-side and supplier-side actions.
15.	Ensure organization ownership is validated on every contract action.
16.	Prevent duplicate submissions and invalid state transitions.
17.	Add validation at service and database levels where appropriate.
18.	Reuse existing notification and communication infrastructure.
19.	Do not make procurement-type-specific UI generic where a specialized UI is clearly required.
20.	Do not create unnecessary complexity merely to match this proposal.
________________________________________
42. EXPECTED OUTPUT
After inspecting the repository, provide a detailed report with the following structure:
A. Current Post-Award Implementation
Explain what already exists.
B. Current Architecture
Explain current frontend, backend, database, workflows, and routes related to Post-Award.
C. Gap Analysis
For every major feature, classify it as:
•	COMPLETE
•	PARTIAL
•	FRONTEND ONLY
•	BACKEND ONLY
•	DATABASE ONLY
•	MISSING
D. Problems in the Current Design
Identify architectural, workflow, database, security, consistency, and usability problems.
E. Recommended Post-Award Architecture
Explain the final recommended design.
F. Procurement-Type Workflows
Explain separately:
•	Goods
•	Works
•	Non-Consultancy Services
•	Consultancy
G. Database Changes
List:
•	Models to reuse
•	Models to modify
•	New models genuinely required
•	Relations
•	Enums
•	Indexes
•	Constraints
H. Backend Changes
List:
•	Services
•	Controllers
•	Routes
•	State transition rules
•	Validation
•	Authorization
•	Transactions
•	Events
I. Frontend Changes
List:
•	Pages
•	Tabs
•	Workspaces
•	Components
•	Dashboards
•	Forms
•	Type-specific custom UI
J. Integration Changes
Explain integration with:
•	Tendering
•	Bidding
•	Evaluation
•	Awarding
•	Contract formation
•	Communication center
•	Notifications
•	Records and history
•	Supplier performance
•	AI risk layer
K. Recommended Implementation Order
Provide the safest dependency-aware implementation sequence.
L. Files That Would Be Modified
List the actual files and directories based on the repository.
M. Risks and Migration Concerns
Identify:
•	Existing data migration
•	Breaking changes
•	Duplicate concepts
•	State migration
•	API compatibility
•	Frontend compatibility
N. Final Recommendation
Explain what should be implemented first and why.
Do not start implementing code until the analysis is complete.
After the analysis, propose the implementation plan and wait for a separate instruction before making large code changes.
The final goal is for ProcureX Post-Award to become a full contract execution and performance management system, not simply an Active Contracts page or document repository.
 ADDITIONAL REQUIREMENT: DEFINE BUYER-SIDE AND SUPPLIER-SIDE EXPERIENCE FOR EVERY POST-AWARD FEATURE
For every Post-Award module, workflow, page, tab, action, and status, do not describe only the general system behavior.
You must explicitly define:
1.	What the Buyer should see
2.	What actions the Buyer should be able to perform
3.	What the Supplier should see
4.	What actions the Supplier should be able to perform
5.	What both parties should be allowed to see
6.	What information should remain private to one party
7.	What system-generated actions, validations, notifications, and status changes should occur
Do this for every Post-Award feature described below.
The system must maintain a shared contract record while still giving the Buyer and Supplier different role-based interfaces and actions.
The Buyer and Supplier should not simply see the same page with different buttons hidden. Where their responsibilities are genuinely different, their dashboard, actions, workflow wording, information hierarchy, and urgent actions should reflect their role.
________________________________________
1. POST-AWARD DASHBOARD
BUYER SHOULD SEE
The Buyer should see contracts where their organization is the procuring or purchasing organization.
The Buyer dashboard should show:
•	Active contracts
•	Contracts awaiting activation
•	Contracts requiring Buyer action
•	Contracts at risk
•	Overdue supplier obligations
•	Upcoming milestones
•	Pending deliveries
•	Pending inspections
•	Pending acceptance decisions
•	Pending invoices
•	Pending variation requests
•	Pending extension requests
•	Open claims
•	Open disputes
•	Expiring guarantees
•	Contracts approaching completion
•	Contracts in warranty or defects period
Each contract summary should show:
•	Contract title
•	Supplier
•	Contract number
•	Procurement type
•	Current contract value
•	Start date
•	Current completion date
•	Current stage
•	Progress percentage
•	Time status
•	Cost status
•	Quality status
•	Risk status
•	Payment status
•	Next required Buyer action
BUYER SHOULD BE ABLE TO
•	Open the contract workspace
•	Review supplier submissions
•	Approve or reject allowed submissions
•	Schedule inspections
•	Record inspection results
•	Issue acceptance or rejection
•	Review invoices
•	Review variations
•	Review extensions
•	Raise issues
•	Raise non-conformance records
•	Issue formal notices
•	Record Buyer-side progress information
•	Manage risks
•	Review supplier performance
•	Initiate completion or termination processes where allowed
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see contracts awarded to their organization.
The Supplier dashboard should show:
•	Newly activated contracts
•	Contracts requiring supplier action
•	Upcoming delivery obligations
•	Upcoming milestone deadlines
•	Deliverables awaiting submission
•	Deliverables returned for revision
•	Inspection requests
•	Rejected or partially accepted items
•	Open corrective actions
•	Unpaid approved invoices
•	Invoices under review
•	Payment history
•	Variation requests
•	Extension requests
•	Claims
•	Formal notices
•	Warranty obligations
•	Defects requiring correction
Each contract summary should show:
•	Contract title
•	Buyer
•	Contract number
•	Procurement type
•	Contract value
•	Start date
•	Current completion date
•	Current stage
•	Supplier progress
•	Next supplier obligation
•	Upcoming deadline
•	Payment summary
•	Open issues
SUPPLIER SHOULD BE ABLE TO
•	Open the contract workspace
•	Submit milestones and deliverables
•	Submit delivery notices
•	Upload evidence
•	Request inspection where applicable
•	Respond to non-conformance
•	Submit corrective action evidence
•	Submit invoices
•	Request variations
•	Request extensions
•	Raise claims
•	Respond to Buyer notices
•	Submit progress reports
•	Report risks or issues
•	Participate in closeout
•	Complete warranty or defect obligations
________________________________________
2. CONTRACT ACTIVATION
BUYER SHOULD SEE
The Buyer should see an activation checklist containing:
•	Signed contract status
•	Required Buyer signatures
•	Required Supplier signatures
•	Contract schedules
•	Final specifications
•	Final BOQ or pricing schedule
•	Final terms of reference
•	Implementation schedule
•	Required performance security
•	Advance payment guarantee
•	Required insurance
•	Contract manager assignment
•	Supplier representative
•	Effective date
•	Commencement date
•	Planned completion date
•	Kick-off requirements
The Buyer should clearly see:
•	Complete items
•	Missing items
•	Items awaiting Supplier action
•	Items awaiting Buyer verification
•	Blocking conditions preventing activation
BUYER SHOULD BE ABLE TO
•	Verify required contract documents
•	Verify guarantees
•	Verify insurance
•	Assign the contract manager
•	Define or confirm commencement date
•	Confirm implementation dates
•	Schedule kick-off
•	Reject invalid activation documents
•	Request replacement documents
•	Activate the contract only after mandatory conditions are satisfied
The Buyer should not be allowed to activate the contract when mandatory activation conditions remain incomplete unless the contract rules explicitly allow an override and the override is recorded.
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Contract activation status
•	Documents already accepted
•	Missing Supplier documents
•	Required guarantees
•	Required insurance
•	Required implementation documents
•	Required representative assignment
•	Activation blockers
•	Buyer verification status
SUPPLIER SHOULD BE ABLE TO
•	Upload required security documents
•	Upload insurance
•	Assign an authorized contract representative
•	Submit the implementation schedule
•	Submit required mobilization documents
•	Correct rejected activation documents
•	Acknowledge effective and commencement dates
•	Confirm readiness where required
The Supplier should not be able to activate the contract itself.
________________________________________
3. CONTRACT MANAGEMENT PLAN
BUYER SHOULD SEE
The Buyer should see the full Contract Management Plan, including:
•	Contract objectives
•	Contract scope
•	Supplier obligations
•	Buyer obligations
•	Milestones
•	Deliverables
•	Acceptance criteria
•	Required evidence
•	Payment schedule
•	Risks
•	KPIs
•	Communication rules
•	Reporting schedule
•	Escalation procedure
•	Change procedure
•	Closeout requirements
BUYER SHOULD BE ABLE TO
•	Review the automatically generated plan
•	Add internal contract management responsibilities
•	Configure Buyer-side monitoring tasks
•	Add Buyer-only risks
•	Define internal review responsibilities
•	Confirm acceptance criteria
•	Define inspection responsibilities
•	Approve the final management plan
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see all contractual parts relevant to contract execution, including:
•	Obligations
•	Deliverables
•	Milestones
•	Deadlines
•	Evidence requirements
•	Acceptance criteria
•	Payment conditions
•	Reporting requirements
•	Communication procedures
•	Approved contract risks relevant to both parties
SUPPLIER SHOULD BE ABLE TO
•	Review the implementation obligations
•	Acknowledge the plan where required
•	Propose implementation details where allowed
•	Assign responsible persons
•	Add implementation risks
•	Submit required execution schedules
The Supplier should not see Buyer-only internal approval assignments, confidential internal risk notes, or internal procurement control notes.
________________________________________
4. CONTRACT WORKSPACE
For every contract, create a shared contract workspace with role-specific views.
BUYER WORKSPACE
The Buyer should have access to:
•	Contract Overview
•	Supplier Obligations
•	Buyer Obligations
•	Milestones
•	Deliverables
•	Deliveries
•	Progress
•	Inspection
•	Acceptance
•	Invoices
•	Payments
•	Variations
•	Extensions
•	Risks
•	Issues
•	Non-Conformance
•	Claims
•	Disputes
•	Performance
•	Guarantees
•	Insurance
•	Communication
•	Meetings
•	Audit Trail
•	Warranty
•	Closeout
The Buyer should see supplier submissions as items requiring review.
________________________________________
SUPPLIER WORKSPACE
The Supplier should have access to:
•	Contract Overview
•	My Obligations
•	Upcoming Deadlines
•	Milestones
•	Deliverables
•	Deliveries
•	Progress Reports
•	Inspection Requests
•	Acceptance Results
•	Corrective Actions
•	Invoices
•	Payments
•	Variations
•	Extensions
•	Risks
•	Issues
•	Claims
•	Disputes
•	Communication
•	Meetings
•	Performance Summary
•	Warranty Obligations
•	Closeout
The Supplier should primarily see:
•	What must I do?
•	When is it due?
•	What evidence is required?
•	Has the Buyer reviewed it?
•	Was it accepted?
•	Can I invoice?
•	Has payment been made?
________________________________________
5. MILESTONES
BUYER SHOULD SEE
For each milestone:
•	Planned start
•	Planned completion
•	Actual progress
•	Supplier submission
•	Required evidence
•	Acceptance criteria
•	Payment linkage
•	Delay status
•	Review history
BUYER SHOULD BE ABLE TO
•	Review milestone evidence
•	Request clarification
•	Request revision
•	Accept milestone
•	Partially accept where permitted
•	Reject milestone
•	Record reasons
•	Raise non-conformance
•	Schedule inspection
•	Approve payment eligibility when applicable
________________________________________
SUPPLIER SHOULD SEE
For each milestone:
•	Description
•	Due date
•	Required evidence
•	Acceptance criteria
•	Current status
•	Buyer comments
•	Linked payment amount or percentage
•	Days remaining
•	Delay status
SUPPLIER SHOULD BE ABLE TO
•	Start milestone
•	Update progress
•	Upload evidence
•	Submit milestone for review
•	Respond to Buyer comments
•	Submit revised evidence
•	View acceptance decision
The Supplier should not be able to mark an approval-controlled milestone as accepted or completed by themselves.
________________________________________
6. GOODS DELIVERY
BUYER SHOULD SEE
The Buyer should see:
•	Planned delivery schedule
•	Dispatch notices
•	Expected delivery dates
•	Delivery locations
•	Goods items
•	Quantities
•	Batch information
•	Serial numbers where applicable
•	Delivery status
•	Receipt status
•	Inspection status
•	Acceptance status
BUYER SHOULD BE ABLE TO
•	Confirm arrival
•	Record goods receipt
•	Record quantity received
•	Record damaged quantity
•	Record missing quantity
•	Record rejected quantity
•	Schedule inspection
•	Conduct inspection
•	Accept
•	Partially accept
•	Reject
•	Raise non-conformance
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Required delivery schedule
•	Items required
•	Quantity required
•	Delivery location
•	Due date
•	Special delivery instructions
•	Current receipt status
•	Inspection result
•	Accepted quantity
•	Rejected quantity
SUPPLIER SHOULD BE ABLE TO
•	Create dispatch notice
•	Enter carrier information
•	Enter vehicle details
•	Upload packing list
•	Upload delivery note
•	Enter tracking information
•	Notify Buyer of expected arrival
•	View receipt confirmation
•	Respond to shortages or rejection
•	Arrange replacement delivery
________________________________________
7. GOODS RECEIPT
BUYER SHOULD SEE AND DO
The Buyer should record:
•	Quantity ordered
•	Quantity delivered
•	Quantity physically received
•	Quantity damaged
•	Quantity missing
•	Quantity rejected
•	Quantity pending inspection
The Buyer should generate a Goods Receipt record.
Receipt should not automatically mean acceptance.
________________________________________
SUPPLIER SHOULD SEE AND DO
The Supplier should see:
•	Quantity confirmed as received
•	Differences between dispatched and received quantities
•	Damage reports
•	Missing item reports
•	Receipt acknowledgement
The Supplier should be able to:
•	Respond to discrepancies
•	Submit replacement plan
•	Submit supporting evidence
________________________________________
8. INSPECTION
BUYER SHOULD SEE
The Buyer should see:
•	Items awaiting inspection
•	Inspection checklist
•	Contract requirement
•	Specification
•	Acceptance criteria
•	Previous inspection results
•	Supplier evidence
BUYER SHOULD BE ABLE TO
•	Schedule inspection
•	Assign inspector
•	Complete checklist
•	Record findings
•	Upload photos
•	Record test results
•	Pass
•	Fail
•	Partially pass
•	Require reinspection
•	Raise non-conformance
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Inspection status
•	Scheduled date
•	Required preparation
•	Items to be inspected
•	Inspection result
•	Findings
•	Required corrective action
SUPPLIER SHOULD BE ABLE TO
•	Request inspection where required
•	Confirm readiness
•	Upload pre-inspection evidence
•	Respond to findings
•	Submit correction evidence
•	Request reinspection
________________________________________
9. ACCEPTANCE
BUYER SHOULD SEE AND DO
The Buyer should review:
•	Delivery
•	Inspection result
•	Evidence
•	Contract requirement
•	Outstanding defects
The Buyer should be able to issue:
•	Accepted
•	Partially Accepted
•	Conditionally Accepted
•	Rejected
The Buyer should record reasons and accepted quantities or deliverables.
________________________________________
SUPPLIER SHOULD SEE AND DO
The Supplier should see:
•	Acceptance decision
•	Accepted amount or quantity
•	Rejected amount or quantity
•	Reasons
•	Conditions
•	Next required action
•	Payment eligibility
The Supplier should be able to:
•	Acknowledge decision
•	Correct rejected items
•	Resubmit where allowed
________________________________________
10. WORKS: SITE HANDOVER
BUYER SHOULD SEE AND DO
The Buyer should:
•	Schedule site handover
•	Confirm site availability
•	Record site condition
•	Upload handover documents
•	Record restrictions
•	Record access limitations
•	Confirm possession date
________________________________________
SUPPLIER SHOULD SEE AND DO
The Contractor should:
•	View site handover schedule
•	Confirm attendance
•	Acknowledge site condition
•	Record observations
•	Raise immediate access issues
•	Sign or acknowledge handover
________________________________________
11. WORKS: MOBILIZATION
BUYER SHOULD SEE
•	Required personnel
•	Required equipment
•	Required permits
•	Required insurance
•	Health and safety plan
•	Environmental plan
•	Programme of works
•	Mobilization progress
BUYER SHOULD BE ABLE TO
•	Verify mobilization
•	Accept or reject required submissions
•	Record missing resources
•	Raise mobilization issues
________________________________________
SUPPLIER SHOULD SEE
The Contractor should see all mobilization obligations.
SUPPLIER SHOULD BE ABLE TO
•	Submit personnel
•	Submit equipment details
•	Upload plans
•	Upload permits
•	Upload insurance
•	Report mobilization progress
•	Confirm readiness to commence work
________________________________________
12. WORKS PROGRESS
BUYER SHOULD SEE
•	Planned progress
•	Actual progress
•	Delayed activities
•	Critical activities
•	Work photos
•	Site reports
•	Labour
•	Equipment
•	Safety incidents
•	Weather impact
BUYER SHOULD BE ABLE TO
•	Review progress report
•	Comment
•	Request clarification
•	Verify reported progress
•	Record Buyer observation
•	Raise delay or performance issue
________________________________________
SUPPLIER SHOULD SEE
•	Required reporting period
•	Planned work
•	Previous progress
•	Current obligations
•	Buyer comments
SUPPLIER SHOULD BE ABLE TO
•	Submit daily, weekly, or monthly progress
•	Upload photos
•	Report labour
•	Report equipment
•	Report work completed
•	Report delays
•	Report safety incidents
•	Report weather impact
•	Submit mitigation plan
________________________________________
13. BOQ MEASUREMENT
BUYER SHOULD SEE
For each BOQ item:
•	Contract quantity
•	Previous certified quantity
•	Current claimed quantity
•	Cumulative claimed quantity
•	Verified quantity
•	Remaining quantity
•	Rate
•	Claimed amount
•	Certified amount
BUYER SHOULD BE ABLE TO
•	Review measurements
•	Adjust verified quantities
•	Record justification
•	Approve measurements
•	Reject unsupported quantities
________________________________________
SUPPLIER SHOULD SEE
The Contractor should see:
•	BOQ items
•	Contract quantities
•	Previous certified quantities
•	Remaining quantities
•	Rates
SUPPLIER SHOULD BE ABLE TO
•	Submit current measured quantity
•	Upload measurement evidence
•	Submit valuation
•	Respond to Buyer adjustments
________________________________________
14. INTERIM PAYMENT CERTIFICATES
BUYER SHOULD SEE
•	Contractor claim
•	Verified measurements
•	Previous payments
•	Retention
•	Advance recovery
•	Deductions
•	Certified amount
BUYER SHOULD BE ABLE TO
•	Review valuation
•	Certify amount
•	Reject unsupported amount
•	Generate payment certificate
•	Approve invoice eligibility
________________________________________
SUPPLIER SHOULD SEE
•	Submitted valuation
•	Adjustments
•	Certified amount
•	Retention
•	Deductions
•	Amount eligible for invoice
SUPPLIER SHOULD BE ABLE TO
•	Submit valuation
•	Provide evidence
•	View certification result
•	Submit invoice based on certified amount
________________________________________
15. SERVICES AND SLA MANAGEMENT
BUYER SHOULD SEE
•	SLA requirements
•	Actual performance
•	Missed targets
•	Incidents
•	Complaints
•	Service reports
•	Potential service credits
•	Repeated breaches
BUYER SHOULD BE ABLE TO
•	Review performance
•	Verify SLA measurements
•	Record service failure
•	Approve or reject service report
•	Apply contractually valid service credits
•	Raise performance issue
________________________________________
SUPPLIER SHOULD SEE
•	Required SLA
•	Current performance
•	Breach warnings
•	Service incidents
•	Buyer comments
SUPPLIER SHOULD BE ABLE TO
•	Submit service report
•	Submit SLA evidence
•	Explain breach
•	Submit corrective action
•	Dispute inaccurate measurement through the proper workflow
________________________________________
16. CONSULTANCY DELIVERABLES
BUYER SHOULD SEE
•	Deliverable requirement
•	Due date
•	Version history
•	Current submission
•	Reviewer comments
•	Acceptance criteria
BUYER SHOULD BE ABLE TO
•	Review submission
•	Add comments
•	Request revision
•	Accept
•	Reject
•	Approve payment eligibility
________________________________________
SUPPLIER SHOULD SEE
•	Required deliverable
•	Due date
•	Required format
•	Acceptance criteria
•	Previous comments
•	Version history
SUPPLIER SHOULD BE ABLE TO
•	Submit deliverable
•	Upload new version
•	Respond to comments
•	Resubmit
•	View approval
Previous versions must remain visible and immutable.
________________________________________
17. NON-CONFORMANCE
BUYER SHOULD SEE AND DO
The Buyer should be able to raise a non-conformance containing:
•	Description
•	Related requirement
•	Severity
•	Required correction
•	Deadline
•	Evidence
The Buyer should:
•	Review Supplier response
•	Accept corrective action plan
•	Reject inadequate corrective action
•	Verify correction
•	Close the non-conformance
________________________________________
SUPPLIER SHOULD SEE AND DO
The Supplier should see:
•	Non-conformance description
•	Evidence
•	Severity
•	Required correction
•	Deadline
The Supplier should be able to:
•	Respond
•	Accept or contest facts
•	Submit corrective action plan
•	Upload correction evidence
•	Request verification
________________________________________
18. INVOICES
BUYER SHOULD SEE
The Buyer should see:
•	Invoice
•	Contract reference
•	Related milestone
•	Related delivery
•	Acceptance record
•	Certificate
•	Invoice amount
•	Taxes
•	Previous payments
•	Match result
BUYER SHOULD BE ABLE TO
•	Verify invoice
•	Run or review matching
•	Request correction
•	Reject invalid invoice
•	Approve invoice
•	Recommend payment
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Invoice eligibility
•	Accepted value
•	Amount already invoiced
•	Remaining invoiceable amount
•	Required supporting documents
SUPPLIER SHOULD BE ABLE TO
•	Create invoice
•	Link invoice to accepted work or delivery
•	Upload supporting documents
•	Submit invoice
•	Correct returned invoice
•	Track approval and payment
________________________________________
19. THREE-WAY MATCHING
BUYER SHOULD SEE
The Buyer should see a reconciliation between:
•	Contract or order
•	Receipt or acceptance
•	Invoice
The Buyer should clearly see mismatches.
BUYER SHOULD BE ABLE TO
•	Review mismatch
•	Approve valid partial amount
•	Return invoice
•	Escalate suspicious invoice
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see enough information to understand why the invoice failed.
Examples:
•	Invoiced quantity exceeds accepted quantity
•	Price differs from contract
•	Required acceptance missing
The Supplier should not see confidential Buyer-side fraud risk notes.
________________________________________
20. PAYMENT
BUYER SHOULD SEE
•	Approved invoice
•	Amount payable
•	Tax
•	Retention
•	Advance recovery
•	Deductions
•	Payment status
•	Transaction reference
BUYER SHOULD BE ABLE TO
•	Recommend payment
•	Approve payment where authorized
•	Record payment initiation
•	Record completed payment
•	Upload payment evidence
________________________________________
SUPPLIER SHOULD SEE
•	Approved amount
•	Deductions
•	Net amount
•	Payment status
•	Payment date
•	Reference
SUPPLIER SHOULD BE ABLE TO
•	View payment progress
•	Confirm receipt
•	Raise payment issue
The Supplier should not control Buyer approval states.
________________________________________
21. VARIATIONS
BUYER SHOULD SEE
•	Variation request
•	Requesting party
•	Reason
•	Scope impact
•	Cost impact
•	Time impact
•	Technical review
•	Budget impact
•	Current contract baseline
BUYER SHOULD BE ABLE TO
•	Create Buyer-initiated variation
•	Review Supplier variation request
•	Request clarification
•	Approve
•	Partially approve
•	Reject
•	Generate amendment
________________________________________
SUPPLIER SHOULD SEE
•	Existing contract baseline
•	Variation request
•	Buyer decision
•	Approved scope
•	Approved value
•	Approved time impact
SUPPLIER SHOULD BE ABLE TO
•	Request variation
•	Explain reason
•	Submit cost impact
•	Submit time impact
•	Upload evidence
•	Accept approved amendment where required
Neither party should directly overwrite the signed original contract.
________________________________________
22. EXTENSIONS OF TIME
BUYER SHOULD SEE
•	Days requested
•	Reason
•	Evidence
•	Affected milestones
•	Previous extensions
•	Delay analysis
BUYER SHOULD BE ABLE TO
•	Approve
•	Partially approve
•	Reject
•	Record approved days
•	Update current completion date
________________________________________
SUPPLIER SHOULD SEE
•	Current completion date
•	Eligible extension request form
•	Previous extension decisions
SUPPLIER SHOULD BE ABLE TO
•	Request extension
•	Enter days requested
•	Explain cause
•	Upload evidence
•	Submit mitigation plan
•	View decision
________________________________________
23. RISKS
BUYER SHOULD SEE
Buyer should see:
•	Shared contract risks
•	Buyer-owned risks
•	Supplier-reported risks
•	Internal Buyer-only risks
BUYER SHOULD BE ABLE TO
•	Add risk
•	Assign owner
•	Update score
•	Add mitigation
•	Escalate critical risk
________________________________________
SUPPLIER SHOULD SEE
Supplier should see:
•	Shared risks
•	Supplier-owned risks
•	Risks affecting Supplier obligations
SUPPLIER SHOULD BE ABLE TO
•	Report risk
•	Add mitigation
•	Update Supplier-owned risk
Buyer-only internal risks may remain private.
________________________________________
24. ISSUES
BUYER SHOULD SEE AND DO
The Buyer should:
•	View all shared contract issues
•	Raise issue
•	Assign action
•	Set deadline
•	Escalate issue
________________________________________
SUPPLIER SHOULD SEE AND DO
The Supplier should:
•	View issues affecting them
•	Raise issue
•	Respond
•	Submit resolution evidence
Internal Buyer administrative issues should remain private.
________________________________________
25. CLAIMS
BUYER SHOULD SEE
•	Supplier claims
•	Buyer claims
•	Evidence
•	Amount
•	Time impact
•	Responses
•	Determination history
BUYER SHOULD BE ABLE TO
•	Raise claim
•	Respond to Supplier claim
•	Request evidence
•	Assess
•	Negotiate
•	Record determination
________________________________________
SUPPLIER SHOULD SEE
•	Claims raised against Supplier
•	Supplier-submitted claims
•	Buyer responses
•	Current stage
SUPPLIER SHOULD BE ABLE TO
•	Raise claim
•	Respond to Buyer claim
•	Submit evidence
•	Negotiate
•	Accept or challenge determination according to the contract process
________________________________________
26. DISPUTES
BUYER AND SUPPLIER SHOULD BOTH SEE
•	Dispute subject
•	Related claim
•	Amount
•	Evidence
•	Current stage
•	Previous decisions
•	Required next action
Both parties should be able to submit:
•	Statements
•	Evidence
•	Responses
•	Settlement proposals
Only authorized users should change formal dispute stages.
________________________________________
27. CONTRACT COMMUNICATION
BUYER SHOULD SEE
All contract-related communications relevant to the Buyer organization.
The Buyer should be able to send:
•	Ordinary message
•	Formal notice
•	Notice to correct
•	Delay notice
•	Default notice
•	Variation notice
•	Termination notice
________________________________________
SUPPLIER SHOULD SEE
All communications addressed to the Supplier organization.
The Supplier should be able to:
•	Reply
•	Acknowledge formal notice
•	Submit formal response
•	Send contractual communication
•	Raise clarification
Formal notices must remain immutable.
________________________________________
28. MEETINGS
BUYER SHOULD SEE AND DO
The Buyer should:
•	Schedule meetings
•	Set agenda
•	Record minutes
•	Assign actions
•	Track overdue actions
________________________________________
SUPPLIER SHOULD SEE AND DO
The Supplier should:
•	View meetings
•	Confirm attendance
•	Comment on minutes where allowed
•	Complete assigned actions
•	Upload action evidence
________________________________________
29. GUARANTEES AND INSURANCE
BUYER SHOULD SEE
•	Required guarantee
•	Submitted document
•	Issuer
•	Amount
•	Validity
•	Expiry
•	Verification status
BUYER SHOULD BE ABLE TO
•	Verify
•	Reject
•	Request replacement
•	Record release
________________________________________
SUPPLIER SHOULD SEE
•	Required guarantee
•	Required amount
•	Required validity
•	Expiry warning
•	Verification result
SUPPLIER SHOULD BE ABLE TO
•	Submit
•	Replace
•	Extend
•	Upload renewal
________________________________________
30. PERFORMANCE EVALUATION
BUYER SHOULD SEE
The Buyer should see system-calculated Supplier performance based on:
•	Time
•	Quality
•	Acceptance
•	Defects
•	SLA
•	Invoice accuracy
•	Compliance
•	Responsiveness
BUYER SHOULD BE ABLE TO
•	Add authorized evaluator assessment
•	Add evidence
•	Finalize evaluation
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Final or publishable performance metrics
•	Supporting contract facts
•	Areas of good performance
•	Areas requiring improvement
The Supplier should be able to:
•	Acknowledge
•	Submit factual correction request
•	Provide response where the process allows
The Supplier should not be able to directly edit the score.
________________________________________
31. WARRANTY AND DEFECTS
BUYER SHOULD SEE
•	Warranty items
•	Warranty period
•	Defects
•	Supplier response
•	Repair or replacement status
•	Due dates
BUYER SHOULD BE ABLE TO
•	Report defect
•	Request correction
•	Verify resolution
•	Close warranty issue
________________________________________
SUPPLIER SHOULD SEE
•	Open defects
•	Warranty obligation
•	Required action
•	Deadline
SUPPLIER SHOULD BE ABLE TO
•	Respond
•	Schedule repair
•	Replace item
•	Submit completion evidence
________________________________________
32. CONTRACT COMPLETION
BUYER SHOULD SEE
The Buyer should see whether:
•	All obligations are complete
•	All deliverables are accepted
•	All issues are resolved
•	Financial obligations are settled
•	Performance evaluation is complete
•	Required completion certificates exist
BUYER SHOULD BE ABLE TO
•	Initiate completion review
•	Confirm completion
•	Issue completion certificate
•	Move contract into warranty or closing stage
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Outstanding obligations
•	Outstanding documents
•	Outstanding financial items
•	Completion status
SUPPLIER SHOULD BE ABLE TO
•	Request completion
•	Submit final documents
•	Submit final deliverable
•	Submit final account
•	Respond to outstanding items
________________________________________
33. CONTRACT CLOSEOUT
BUYER SHOULD SEE
The Buyer should use a closeout checklist.
BUYER SHOULD BE ABLE TO
•	Confirm contractual completion
•	Confirm financial settlement
•	Confirm claims status
•	Confirm guarantee release
•	Confirm records
•	Complete Supplier performance evaluation
•	Close contract
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see:
•	Closeout status
•	Outstanding Supplier requirements
•	Final payment status
•	Guarantee release status
•	Warranty obligations if any
SUPPLIER SHOULD BE ABLE TO
•	Submit outstanding closure documents
•	Confirm final settlement
•	Complete Supplier-side closeout actions
The Supplier should not unilaterally close the contract.
________________________________________
34. TERMINATION
BUYER SHOULD SEE AND DO
The Buyer should be able to:
•	Propose termination
•	Record grounds
•	Upload evidence
•	Issue notice
•	Review Supplier response
•	Record decision
•	Complete termination settlement
________________________________________
SUPPLIER SHOULD SEE AND DO
The Supplier should:
•	Receive termination notice
•	View grounds
•	Submit response
•	Submit cure action where allowed
•	Upload evidence
•	Participate in settlement
The Supplier may also initiate termination request where the contract allows it.
________________________________________
35. AUDIT TRAIL
BUYER SHOULD SEE
The Buyer should see all shared contract events and Buyer-authorized internal events.
________________________________________
SUPPLIER SHOULD SEE
The Supplier should see shared events relevant to the Supplier.
The Supplier should not see:
•	Confidential Buyer investigation notes
•	Internal approval notes
•	Internal fraud assessment
•	Internal legal advice
•	Internal Buyer risk commentary
The audit trail itself must be immutable.
________________________________________
36. URGENT ACTIONS
BUYER URGENT ACTIONS
Examples:
•	Supplier milestone overdue
•	Delivery awaiting receipt
•	Inspection required
•	Acceptance decision overdue
•	Invoice awaiting review
•	Variation awaiting decision
•	Extension awaiting decision
•	Guarantee expiring
•	Claim awaiting response
•	Contract approaching completion
________________________________________
SUPPLIER URGENT ACTIONS
Examples:
•	Milestone due soon
•	Deliverable overdue
•	Buyer requested revision
•	Inspection preparation required
•	Non-conformance correction due
•	Invoice returned
•	Guarantee expiring
•	Buyer notice requires response
•	Warranty defres action
Urgent actions must be generated from actual backend workflow state.
________________________________________
37. SHARED VS PRIVATE INFORMATION
Codex must classify every important field or record into one of:
SHARED
Visible to both Buyer and Supplier.
Examples:
•	Signed contract
•	Approved milestone
•	Deliverable submission
•	Acceptance decision
•	Formal notice
•	Approved variation
•	Payment status
BUYER PRIVATE
Visible only to authorized Buyer users.
Examples:
•	Internal approval notes
•	Internal risk assessment
•	Internal payment recommendation
•	Internal investigation note
•	Confidential legal advice
SUPPLIER PRIVATE
Visible only to authorized Supplier users.
Examples:
•	Internal draft before submission
•	Internal preparation notes
•	Internal costing preparation before formal variation submission
Never expose private organization information through general contract APIs.
________________________________________
38. REQUIRED OUTPUT FORMAT FOR CODEX
For every feature in the final architecture report, use this exact structure:
FEATURE NAME
Current Implementation
Explain what already exists.
Buyer Sees
List the information visible to the Buyer.
Buyer Can Do
List all allowed Buyer actions.
Supplier Sees
List the information visible to the Supplier.
Supplier Can Do
List all allowed Supplier actions.
Shared Information
Explain what both parties see.
Private Information
Explain what remains Buyer-only or Supplier-only.
System Automatically Does
Explain:
•	Status changes
•	Validation
•	Notifications
•	Audit events
•	Calculations
•	Deadline detection
•	Permission checks
Backend Requirements
Explain:
•	Routes
•	Services
•	Validation
•	Authorization
•	Events
Database Requirements
Explain:
•	Models
•	Fields
•	Relations
•	Statuses
•	Constraints
Frontend Requirements
Explain:
•	Buyer page
•	Supplier page
•	Shared components
•	Role-specific components
Current Gap
Classify as:
•	COMPLETE
•	PARTIAL
•	FRONTEND ONLY
•	BACKEND ONLY
•	DATABASE ONLY
•	MISSING
________________________________________
FINAL DESIGN PRINCIPLE
For every Post-Award feature, always answer these questions:
FOR THE BUYER
•	What am I waiting for from the Supplier?
•	What must I review?
•	What decision must I make?
•	What must I monitor?
•	What should alert me?
FOR THE SUPPLIER
•	What do I need to deliver?
•	When must I deliver it?
•	What evidence must I provide?
•	What did the Buyer decide?
•	What must I correct?
•	When can I invoice?
•	Has payment been made?
The Post-Award module should therefore behave as a two-sided contract execution system.
The Buyer manages, reviews, verifies, accepts, controls, monitors, and pays.
The Supplier performs, delivers, submits, reports, corrects, invoices, and responds.
The system connects both parties through controlled workflows, shared evidence, approvals, notifications, and an immutable audit trail.



