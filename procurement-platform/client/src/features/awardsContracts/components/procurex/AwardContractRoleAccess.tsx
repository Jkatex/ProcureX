import { createContext, useContext, type ReactNode } from 'react';
import type { WorkflowAccess, WorkflowActionOwner } from '../../types';
import { StatusBadge } from './AwardsContractsProcurexShared';

const defaultAccess: WorkflowAccess = {
  viewerRole: 'ADMIN',
  canManageBuyerActions: true,
  canSubmitSupplierActions: true,
  canSignBuyer: true,
  canSignSupplier: true,
  readOnlyReason: null,
  hideLockedActions: false
};

const AccessContext = createContext<WorkflowAccess>(defaultAccess);

export function AwardContractAccessProvider({
  access,
  children
}: {
  access?: WorkflowAccess | null;
  children: ReactNode;
}) {
  return <AccessContext.Provider value={access ?? defaultAccess}>{children}</AccessContext.Provider>;
}

export function useAwardContractAccess() {
  return useContext(AccessContext);
}

export function canUseWorkflowOwner(access: WorkflowAccess, owner: WorkflowActionOwner) {
  if (owner === 'ANY') return access.viewerRole !== 'NONE';
  if (owner === 'ADMIN') return access.viewerRole === 'ADMIN';
  if (owner === 'BUYER') return Boolean(access.canManageBuyerActions || access.canSignBuyer);
  return Boolean(access.canSubmitSupplierActions || access.canSignSupplier);
}

export function ownerLockedReason(access: WorkflowAccess, owner: WorkflowActionOwner) {
  if (owner === 'ADMIN') return access.readOnlyReason ?? 'This action belongs to an admin user.';
  if (owner === 'BUYER') return access.readOnlyReason ?? 'This action belongs to the buyer.';
  if (owner === 'SUPPLIER') return access.readOnlyReason ?? 'This action belongs to the supplier.';
  return access.readOnlyReason ?? 'This workflow is read-only for your account.';
}

export function inferActionOwner(title: string, badge?: string): WorkflowActionOwner {
  const text = `${title} ${badge ?? ''}`.toLowerCase();
  if (text.includes('supplier award response')) return 'SUPPLIER';
  if (text.includes('signature request')) return 'BUYER';
  if (text.includes('sign buyer')) return 'BUYER';
  if (text.includes('sign supplier')) return 'SUPPLIER';
  if (text.includes('deliverable')) return 'SUPPLIER';
  if (text.includes('invoice submission')) return 'SUPPLIER';
  if (text.includes('milestone evidence')) return 'SUPPLIER';
  if (text.includes('termination evidence')) return 'SUPPLIER';
  if (text.includes('required document')) return 'SUPPLIER';
  if (text.includes('sign contract')) return 'ANY';
  if (text.includes('negotiation')) return 'ANY';
  if (text.includes('amendment')) return 'ANY';
  if (text.includes('variation')) return title.toLowerCase().includes('update') ? 'BUYER' : 'ANY';
  if (text.includes('issue')) return title.toLowerCase().includes('update') ? 'BUYER' : 'ANY';
  if (text.includes('dispute')) return title.toLowerCase().includes('update') ? 'BUYER' : 'ANY';
  if (text.includes('warranty')) return 'ANY';
  return 'BUYER';
}

export function LockedWorkflowPanel({ title, owner, reason }: { title: string; owner: WorkflowActionOwner; reason: string }) {
  return (
    <section className="award-action-form award-action-form-locked" data-award-contract-form={title}>
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Read-only action</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge value={owner === 'ANY' ? 'Read-only' : owner === 'BUYER' ? 'Buyer' : owner === 'SUPPLIER' ? 'Supplier' : 'Admin'} />
      </div>
      <div className="scope-empty">{reason}</div>
    </section>
  );
}
