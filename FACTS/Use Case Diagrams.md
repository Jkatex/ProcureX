# USE CASE DIAGRAMS
## Procurement Intelligence & Governance Platform

**Version:** 1.0
**Date:** February 18, 2026

---

## System Actors

| Actor | Description | Source Logics |
|---|---|---|
| **Buyer** | Procurement officer who creates tenders, evaluates bids, manages contracts | 1, 3, 4, 8, 10 |
| **Supplier** | Organization or individual who discovers opportunities, submits bids, delivers goods/services | 1, 5, 6, 15, 34 |
| **Evaluator** | Committee member who scores and ranks bids | 8, 17, 18 |
| **Approver** | Authority who approves procurement actions based on value/risk thresholds | 11, 12 |
| **Finance Officer** | Manages budgets, validates invoices, processes payments | 12, 19 |
| **Compliance Officer** | Monitors governance, investigates violations, enforces rules | 14, 23, 29 |
| **Platform Admin** | Manages platform configuration, user verification, system governance | 1, 2, 29, 40 |
| **External System (ERP)** | Integrated enterprise system for data synchronization | 35 |

---

## 1. User Registration & Identity Management (Logics 1, 2, 37)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        S((Supplier))
        PA((Platform Admin))
    end

    subgraph "UC: Identity & Access Management"
        UC1["UC-1.1: Register Account"]
        UC2["UC-1.2: Submit Verification Documents"]
        UC3["UC-1.3: Complete Identity Verification"]
        UC4["UC-1.4: View Trust Tier Status"]
        UC5["UC-1.5: Request Trust Tier Upgrade"]
        UC6["UC-1.6: Manage User Roles"]
        UC7["UC-1.7: Assign Permissions"]
        UC8["UC-1.8: Declare Conflict of Interest"]
        UC9["UC-1.9: Delegate Authority"]
        UC10["UC-1.10: Review Verification Documents"]
        UC11["UC-1.11: Override Trust Level"]
        UC12["UC-1.12: Configure RBAC Rules"]
    end

    B --> UC1
    B --> UC2
    B --> UC4
    B --> UC8
    B --> UC9
    S --> UC1
    S --> UC2
    S --> UC4
    S --> UC5
    S --> UC8
    PA --> UC3
    PA --> UC6
    PA --> UC7
    PA --> UC10
    PA --> UC11
    PA --> UC12
```

---

## 2. Procurement Design & Tender Creation (Logics 3, 24, 36)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        AP((Approver))
    end

    subgraph "UC: Tender Design & Structuring"
        UC1["UC-2.1: Define Procurement Need"]
        UC2["UC-2.2: Enter Technical Specifications"]
        UC3["UC-2.3: Create Bill of Quantities"]
        UC4["UC-2.4: Set Evaluation Criteria & Weights"]
        UC5["UC-2.5: Configure Timeline & Milestones"]
        UC6["UC-2.6: Attach Budget Allocation"]
        UC7["UC-2.7: Select Tender Template"]
        UC8["UC-2.8: Customize Template Fields"]
        UC9["UC-2.9: Run Design Quality Check"]
        UC10["UC-2.10: Review Bias Detection Report"]
        UC11["UC-2.11: Submit for Internal Approval"]
        UC12["UC-2.12: Approve Tender for Publication"]
        UC13["UC-2.13: Override Quality Warnings"]
    end

    B --> UC1
    B --> UC2
    B --> UC3
    B --> UC4
    B --> UC5
    B --> UC6
    B --> UC7
    B --> UC8
    B --> UC9
    B --> UC10
    B --> UC11
    B --> UC13
    AP --> UC12
```

---

## 3. Tender Publication & Market Visibility (Logics 4, 21, 38)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        S((Supplier))
    end

    subgraph "UC: Publication & Marketplace"
        UC1["UC-3.1: Publish Tender"]
        UC2["UC-3.2: Set Visibility Model"]
        UC3["UC-3.3: Issue Tender Amendment"]
        UC4["UC-3.4: Respond to Clarification Questions"]
        UC5["UC-3.5: Extend Submission Deadline"]
        UC6["UC-3.6: Browse Centralized Tender Index"]
        UC7["UC-3.7: Search Tenders by Category/Region"]
        UC8["UC-3.8: Receive Tender Match Notifications"]
        UC9["UC-3.9: Submit Clarification Questions"]
        UC10["UC-3.10: View Market Price Benchmarks"]
        UC11["UC-3.11: View Participation Analytics"]
        UC12["UC-3.12: Save Tender to Watchlist"]
    end

    B --> UC1
    B --> UC2
    B --> UC3
    B --> UC4
    B --> UC5
    B --> UC11
    S --> UC6
    S --> UC7
    S --> UC8
    S --> UC9
    S --> UC10
    S --> UC12
```

---

## 4. Supplier Discovery & Matching (Logics 5, 22, 25)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        S((Supplier))
    end

    subgraph "UC: Supplier Discovery"
        UC1["UC-4.1: Search Supplier Registry"]
        UC2["UC-4.2: Filter by Category & Capability"]
        UC3["UC-4.3: View Supplier Performance History"]
        UC4["UC-4.4: View Supplier Trust Score"]
        UC5["UC-4.5: View Supplier Capacity Status"]
        UC6["UC-4.6: Receive Supplier Recommendations"]
        UC7["UC-4.7: Invite Supplier to Tender"]
        UC8["UC-4.8: Update Company Profile"]
        UC9["UC-4.9: Declare Capabilities & Certifications"]
        UC10["UC-4.10: Declare Available Capacity"]
        UC11["UC-4.11: View Own Trust Score & Tier"]
        UC12["UC-4.12: View Performance Dashboard"]
    end

    B --> UC1
    B --> UC2
    B --> UC3
    B --> UC4
    B --> UC5
    B --> UC6
    B --> UC7
    S --> UC8
    S --> UC9
    S --> UC10
    S --> UC11
    S --> UC12
```

---

## 5. Bid Submission & Validation (Logic 6)

```mermaid
graph LR
    subgraph Actors
        S((Supplier))
    end

    subgraph "UC: Bid Submission"
        UC1["UC-5.1: Check Eligibility for Tender"]
        UC2["UC-5.2: Prepare Bid Response"]
        UC3["UC-5.3: Enter Line-Item Pricing"]
        UC4["UC-5.4: Upload Technical Documents"]
        UC5["UC-5.5: Upload Financial Documents"]
        UC6["UC-5.6: Validate Bid Completeness"]
        UC7["UC-5.7: Submit Sealed Bid"]
        UC8["UC-5.8: Receive Submission Confirmation"]
        UC9["UC-5.9: Withdraw Bid Before Deadline"]
        UC10["UC-5.10: Resubmit Bid After Withdrawal"]
        UC11["UC-5.11: Submit Physical/Digital Sample"]
    end

    S --> UC1
    S --> UC2
    S --> UC3
    S --> UC4
    S --> UC5
    S --> UC6
    S --> UC7
    S --> UC8
    S --> UC9
    S --> UC10
    S --> UC11
```

---

## 6. Bid Opening & Evaluation (Logics 7, 8, 9, 17, 18, 26)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        EV((Evaluator))
    end

    subgraph "UC: Bid Opening & Evaluation"
        UC1["UC-6.1: Authorize Bid Opening"]
        UC2["UC-6.2: Open Technical Envelopes"]
        UC3["UC-6.3: Verify Bid Integrity Hashes"]
        UC4["UC-6.4: Generate Opening Report"]
        UC5["UC-6.5: Perform Compliance Check"]
        UC6["UC-6.6: Score Technical Criteria"]
        UC7["UC-6.7: Score Financial Criteria"]
        UC8["UC-6.8: Lock Individual Scores"]
        UC9["UC-6.9: Participate in Consensus Review"]
        UC10["UC-6.10: View Price Benchmark Analysis"]
        UC11["UC-6.11: View Cross-Regional Price Normalization"]
        UC12["UC-6.12: Evaluate Physical Samples"]
        UC13["UC-6.13: Evaluate Service Provider Portfolio"]
        UC14["UC-6.14: Interview Named Personnel"]
        UC15["UC-6.15: Open Financial Envelopes"]
        UC16["UC-6.16: View Comparative Bid Rankings"]
        UC17["UC-6.17: Disqualify Non-Compliant Bid"]
        UC18["UC-6.18: Generate Evaluation Report"]
    end

    B --> UC1
    B --> UC2
    B --> UC15
    B --> UC16
    B --> UC18
    EV --> UC3
    EV --> UC4
    EV --> UC5
    EV --> UC6
    EV --> UC7
    EV --> UC8
    EV --> UC9
    EV --> UC10
    EV --> UC11
    EV --> UC12
    EV --> UC13
    EV --> UC14
    EV --> UC17
```

---

## 7. Award Decision & Contract Formation (Logics 10, 13, 16)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        S((Supplier))
        AP((Approver))
    end

    subgraph "UC: Award & Contract"
        UC1["UC-7.1: Review Final Bid Rankings"]
        UC2["UC-7.2: Review Delivery Feasibility Assessment"]
        UC3["UC-7.3: Review Risk Forecast"]
        UC4["UC-7.4: Apply Tie-Breaker Rules"]
        UC5["UC-7.5: Make Award Recommendation"]
        UC6["UC-7.6: Approve Award Decision"]
        UC7["UC-7.7: Notify Winning Supplier"]
        UC8["UC-7.8: Notify Unsuccessful Bidders"]
        UC9["UC-7.9: Enforce Standstill Period"]
        UC10["UC-7.10: Generate Draft Contract"]
        UC11["UC-7.11: Review Contract Terms"]
        UC12["UC-7.12: Digitally Sign Contract"]
        UC13["UC-7.13: Submit Performance Security"]
        UC14["UC-7.14: Accept Award & Sign Contract"]
        UC15["UC-7.15: Challenge Award Decision"]
    end

    B --> UC1
    B --> UC2
    B --> UC3
    B --> UC4
    B --> UC5
    B --> UC7
    B --> UC8
    B --> UC10
    B --> UC11
    B --> UC12
    AP --> UC6
    AP --> UC9
    S --> UC13
    S --> UC14
    S --> UC15
```

---

## 8. Approval Workflow & Budget Management (Logics 11, 12)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        AP((Approver))
        FO((Finance Officer))
    end

    subgraph "UC: Approvals & Budget"
        UC1["UC-8.1: Submit Action for Approval"]
        UC2["UC-8.2: Review Pending Approval"]
        UC3["UC-8.3: Approve/Reject Action"]
        UC4["UC-8.4: Escalate Delayed Approval"]
        UC5["UC-8.5: Delegate Approval Authority"]
        UC6["UC-8.6: View Approval History"]
        UC7["UC-8.7: Allocate Budget"]
        UC8["UC-8.8: Commit Budget to Tender"]
        UC9["UC-8.9: Track Real-Time Spend"]
        UC10["UC-8.10: Request Budget Amendment"]
        UC11["UC-8.11: Approve Budget Amendment"]
        UC12["UC-8.12: View Spend Forecast"]
        UC13["UC-8.13: View Budget Dashboard"]
    end

    B --> UC1
    B --> UC6
    AP --> UC2
    AP --> UC3
    AP --> UC4
    AP --> UC5
    AP --> UC11
    FO --> UC7
    FO --> UC8
    FO --> UC9
    FO --> UC10
    FO --> UC12
    FO --> UC13
```

---

## 9. Post-Award & Contract Management (Logics 15, 19, 20)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        S((Supplier))
        FO((Finance Officer))
    end

    subgraph "UC: Post-Award Operations"
        UC1["UC-9.1: Track Contract Milestones"]
        UC2["UC-9.2: Confirm Goods Receipt"]
        UC3["UC-9.3: Evaluate Supplier Performance"]
        UC4["UC-9.4: Submit Invoice"]
        UC5["UC-9.5: Validate Invoice (3-Way Match)"]
        UC6["UC-9.6: Flag Duplicate/Overbilling"]
        UC7["UC-9.7: Process Payment"]
        UC8["UC-9.8: Raise Formal Dispute"]
        UC9["UC-9.9: Submit Dispute Evidence"]
        UC10["UC-9.10: Respond to Dispute"]
        UC11["UC-9.11: Mediate Dispute"]
        UC12["UC-9.12: Apply Contract Penalty"]
        UC13["UC-9.13: Appeal Dispute Decision"]
        UC14["UC-9.14: Terminate Contract"]
        UC15["UC-9.15: View Performance Dashboard"]
    end

    B --> UC1
    B --> UC2
    B --> UC3
    B --> UC8
    B --> UC9
    B --> UC11
    B --> UC12
    B --> UC14
    S --> UC4
    S --> UC10
    S --> UC13
    S --> UC15
    FO --> UC5
    FO --> UC6
    FO --> UC7
```

---

## 10. Risk, Anti-Collusion & Compliance (Logics 14, 23, 27, 29)

```mermaid
graph LR
    subgraph Actors
        CO((Compliance Officer))
        PA((Platform Admin))
    end

    subgraph "UC: Risk & Compliance"
        UC1["UC-10.1: View Procurement Risk Forecast"]
        UC2["UC-10.2: Run What-If Risk Scenarios"]
        UC3["UC-10.3: Review Collusion Risk Alerts"]
        UC4["UC-10.4: Investigate Bid Pattern Anomalies"]
        UC5["UC-10.5: Extract Collusion Evidence Package"]
        UC6["UC-10.6: Search Audit Trail Records"]
        UC7["UC-10.7: Reconstruct Procurement Timeline"]
        UC8["UC-10.8: Detect Audit Anomalies"]
        UC9["UC-10.9: Record Violation"]
        UC10["UC-10.10: Issue Enforcement Action"]
        UC11["UC-10.11: Review Enforcement Appeal"]
        UC12["UC-10.12: Reinstate Sanctioned User"]
        UC13["UC-10.13: Generate Compliance Report"]
        UC14["UC-10.14: Configure Governance Rules"]
        UC15["UC-10.15: Set Retention Policies"]
    end

    CO --> UC1
    CO --> UC2
    CO --> UC3
    CO --> UC4
    CO --> UC5
    CO --> UC6
    CO --> UC7
    CO --> UC8
    CO --> UC9
    CO --> UC10
    CO --> UC11
    CO --> UC12
    CO --> UC13
    PA --> UC14
    PA --> UC15
```

---

## 11. Market Intelligence & Platform Learning (Logics 28, 30, 31, 38)

```mermaid
graph LR
    subgraph Actors
        B((Buyer))
        S((Supplier))
        PA((Platform Admin))
    end

    subgraph "UC: Intelligence & Analytics"
        UC1["UC-11.1: View Category Price Trends"]
        UC2["UC-11.2: View Regional Market Analytics"]
        UC3["UC-11.3: View Inter-Org Benchmark Data"]
        UC4["UC-11.4: Receive AI-Powered Recommendations"]
        UC5["UC-11.5: View Network Liquidity Dashboard"]
        UC6["UC-11.6: View Competition Density Reports"]
        UC7["UC-11.7: View Market Transparency Dashboard"]
        UC8["UC-11.8: View Bid Success Rate Analytics"]
        UC9["UC-11.9: View Peer Performance Comparisons"]
        UC10["UC-11.10: Monitor Engagement Health"]
        UC11["UC-11.11: View Early Warning Alerts"]
        UC12["UC-11.12: Calibrate Learning Models"]
    end

    B --> UC1
    B --> UC2
    B --> UC3
    B --> UC4
    B --> UC6
    B --> UC7
    S --> UC1
    S --> UC4
    S --> UC7
    S --> UC8
    S --> UC9
    PA --> UC5
    PA --> UC10
    PA --> UC11
    PA --> UC12
```

---

## 12. System Integration & Platform Administration (Logics 35, 40)

```mermaid
graph LR
    subgraph Actors
        PA((Platform Admin))
        ERP((External System))
    end

    subgraph "UC: Integration & Administration"
        UC1["UC-12.1: Configure ERP Integration"]
        UC2["UC-12.2: Map Data Fields to ERP"]
        UC3["UC-12.3: Monitor Sync Status"]
        UC4["UC-12.4: Resolve Sync Errors"]
        UC5["UC-12.5: Trigger Manual Data Sync"]
        UC6["UC-12.6: Install Platform Module"]
        UC7["UC-12.7: Configure Module Settings"]
        UC8["UC-12.8: Manage API Keys"]
        UC9["UC-12.9: View System Health Dashboard"]
        UC10["UC-12.10: Configure Notification Channels"]
        UC11["UC-12.11: Push Tender/Award Data"]
        UC12["UC-12.12: Pull Invoice/PO Data"]
        UC13["UC-12.13: Send Event Webhooks"]
    end

    PA --> UC1
    PA --> UC2
    PA --> UC3
    PA --> UC4
    PA --> UC5
    PA --> UC6
    PA --> UC7
    PA --> UC8
    PA --> UC9
    PA --> UC10
    ERP --> UC11
    ERP --> UC12
    ERP --> UC13
```

---

## 13. Unified Use Case Diagram — All Actors & Key Use Cases

```mermaid
graph TB
    subgraph "ACTORS"
        B((Buyer))
        S((Supplier))
        EV((Evaluator))
        AP((Approver))
        FO((Finance Officer))
        CO((Compliance Officer))
        PA((Platform Admin))
        ERP((ERP System))
    end

    subgraph "IDENTITY & ACCESS"
        A1["Register & Verify Identity"]
        A2["Manage Roles & Permissions"]
        A3["Progress Trust Tiers"]
    end

    subgraph "TENDER DESIGN"
        B1["Define Procurement Need"]
        B2["Set Evaluation Criteria"]
        B3["Run Quality & Bias Check"]
    end

    subgraph "MARKETPLACE"
        C1["Publish Tender"]
        C2["Browse & Search Tenders"]
        C3["Receive Matching Notifications"]
        C4["Ask/Answer Clarifications"]
    end

    subgraph "SUPPLIER MANAGEMENT"
        D1["Manage Supplier Profile"]
        D2["View Trust/Performance Score"]
        D3["Check Supplier Capacity"]
    end

    subgraph "BIDDING"
        E1["Submit Sealed Bid"]
        E2["Validate Bid Completeness"]
        E3["Withdraw/Resubmit Bid"]
    end

    subgraph "EVALUATION"
        F1["Open & Verify Bids"]
        F2["Score Bids (Tech + Financial)"]
        F3["View Price Benchmarks"]
        F4["Rank & Disqualify Bids"]
    end

    subgraph "AWARD & CONTRACT"
        G1["Make Award Decision"]
        G2["Approve Award"]
        G3["Generate & Sign Contract"]
        G4["Enforce Standstill Period"]
    end

    subgraph "BUDGET & APPROVALS"
        H1["Allocate & Track Budget"]
        H2["Submit/Process Approvals"]
        H3["Delegate Authority"]
    end

    subgraph "POST-AWARD"
        I1["Track Milestones & Receipts"]
        I2["Submit & Validate Invoices"]
        I3["Evaluate Performance"]
        I4["Resolve Disputes"]
    end

    subgraph "RISK & COMPLIANCE"
        J1["Forecast Procurement Risk"]
        J2["Detect Collusion Patterns"]
        J3["Search Audit Trails"]
        J4["Enforce Governance Rules"]
    end

    subgraph "INTELLIGENCE"
        K1["View Market Analytics"]
        K2["Receive AI Recommendations"]
        K3["Monitor Network Liquidity"]
    end

    subgraph "INTEGRATION"
        L1["Configure ERP Integration"]
        L2["Sync Data Bi-Directionally"]
        L3["Manage Platform Modules"]
    end

    %% Buyer connections
    B --> A1
    B --> B1
    B --> B2
    B --> B3
    B --> C1
    B --> C4
    B --> D3
    B --> F1
    B --> G1
    B --> G3
    B --> I1
    B --> I3
    B --> I4
    B --> K1

    %% Supplier connections
    S --> A1
    S --> A3
    S --> C2
    S --> C3
    S --> C4
    S --> D1
    S --> D2
    S --> E1
    S --> E2
    S --> E3
    S --> I2
    S --> I4
    S --> K1
    S --> K2

    %% Evaluator connections
    EV --> F1
    EV --> F2
    EV --> F3
    EV --> F4

    %% Approver connections
    AP --> G2
    AP --> G4
    AP --> H2
    AP --> H3

    %% Finance Officer connections
    FO --> H1
    FO --> I2

    %% Compliance Officer connections
    CO --> J1
    CO --> J2
    CO --> J3
    CO --> J4

    %% Platform Admin connections
    PA --> A2
    PA --> K3
    PA --> L1
    PA --> L3

    %% ERP connections
    ERP --> L2
```

---

## Use Case Summary

| Diagram | Use Cases | Primary Actors |
|---|---|---|
| 1. Identity & Access | 12 | Buyer, Supplier, Platform Admin |
| 2. Tender Design | 13 | Buyer, Approver |
| 3. Publication & Marketplace | 12 | Buyer, Supplier |
| 4. Supplier Discovery | 12 | Buyer, Supplier |
| 5. Bid Submission | 11 | Supplier |
| 6. Bid Opening & Evaluation | 18 | Buyer, Evaluator |
| 7. Award & Contract | 15 | Buyer, Supplier, Approver |
| 8. Approvals & Budget | 13 | Buyer, Approver, Finance Officer |
| 9. Post-Award Operations | 15 | Buyer, Supplier, Finance Officer |
| 10. Risk & Compliance | 15 | Compliance Officer, Platform Admin |
| 11. Intelligence & Analytics | 12 | Buyer, Supplier, Platform Admin |
| 12. Integration & Admin | 13 | Platform Admin, ERP System |
| 13. Unified Overview | 36 (key) | All 8 Actors |
| **TOTAL** | **~160 unique** | **8 actors** |

---

## Actor–Use Case Traceability

| Actor | Total Use Cases | Key Areas |
|---|---|---|
| **Buyer** | ~55 | Tender design, publication, evaluation oversight, award, contract, post-award, analytics |
| **Supplier** | ~40 | Registration, discovery, bidding, samples, invoicing, disputes, performance, analytics |
| **Evaluator** | ~18 | Bid opening, technical/financial scoring, samples, consensus, rankings |
| **Approver** | ~15 | Tender approval, award approval, budget amendments, delegation |
| **Finance Officer** | ~12 | Budget allocation, spend tracking, invoice validation, payments |
| **Compliance Officer** | ~15 | Risk forecasting, collusion detection, audit trails, governance enforcement |
| **Platform Admin** | ~18 | Verification, RBAC, governance rules, integrations, modules, monitoring |
| **ERP System** | ~5 | Data sync, webhooks, PO/invoice exchange |

---

**END OF DOCUMENT**
