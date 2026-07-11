import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { FlowLockReason, FlowStep } from '../../types';

const dirtyMessage = 'You have unsaved award or contract action changes. Leave without saving?';

function setDirtyFlag(dirty: boolean) {
  if (typeof document === 'undefined') return;
  if (dirty) {
    document.body.dataset.awardContractDirty = 'true';
    sessionStorage.setItem('procurex.awardContract.dirty', 'true');
  } else {
    delete document.body.dataset.awardContractDirty;
    sessionStorage.removeItem('procurex.awardContract.dirty');
  }
}

export function hasAwardContractDirtyWork() {
  if (typeof document === 'undefined') return false;
  return document.body.dataset.awardContractDirty === 'true' || sessionStorage.getItem('procurex.awardContract.dirty') === 'true';
}

export function clearAwardContractDirtyWork() {
  setDirtyFlag(false);
}

export function confirmAwardContractNavigation(message = dirtyMessage) {
  if (!hasAwardContractDirtyWork()) return true;
  const confirmed = window.confirm(message);
  if (confirmed) clearAwardContractDirtyWork();
  return confirmed;
}

export function useAwardContractFlowGuard(isDirty: boolean, message = dirtyMessage) {
  useEffect(() => {
    setDirtyFlag(isDirty);
    if (!isDirty) return undefined;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setDirtyFlag(false);
    };
  }, [isDirty, message]);

  return {
    confirmLeave: () => confirmAwardContractNavigation(message),
    clearDirty: clearAwardContractDirtyWork
  };
}

export function flowStepStatus(active: string, step: FlowStep, index: number, activeIndex: number) {
  if (step.status === 'locked') return 'locked';
  if (step.id === active) return 'current';
  if (step.status === 'complete' || index < activeIndex) return 'complete';
  return 'available';
}

function defaultFlowStatusLabel(status: ReturnType<typeof flowStepStatus>) {
  if (status === 'current') return 'Current step';
  if (status === 'complete') return 'Complete';
  if (status === 'locked') return 'Locked';
  return 'Ready';
}

function flowCountLabel(step: FlowStep) {
  if (step.count === undefined) return '';
  const label = step.countLabel ?? 'items';
  return `${step.count} ${label}`;
}

function flowBadgeTone(value: string) {
  if (/locked|blocked|missing/i.test(value)) return 'warning';
  if (/complete|approved|ready|linked|issued/i.test(value)) return 'success';
  if (/awaiting|needs|pending|current/i.test(value)) return 'warning';
  return 'info';
}

function FlowStatusBadge({ value }: { value: string }) {
  return <span className={`badge badge-${flowBadgeTone(value)}`}>{value}</span>;
}

export function flowStepFromSearch<TId extends string>(search: string, stepIds: readonly TId[], fallback: TId) {
  const step = new URLSearchParams(search).get('step') as TId | null;
  return step && stepIds.includes(step) ? step : fallback;
}

export function searchWithFlowStep(search: string, step: string) {
  const params = new URLSearchParams(search);
  params.set('step', step);
  return `?${params.toString()}`;
}

export function AwardContractFlowBar<TId extends string>({
  steps,
  active,
  label,
  onSelect
}: {
  steps: Array<FlowStep<TId>>;
  active: TId;
  label: string;
  onSelect: (id: TId) => void;
}) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === active));
  const activeStep = steps[activeIndex];
  const activeStatus = activeStep ? flowStepStatus(active, activeStep, activeIndex, activeIndex) : 'available';
  const progressRatio = steps.length <= 1 ? 0 : activeIndex / (steps.length - 1);
  return (
    <section className="award-flow-shell" aria-label={label}>
      {activeStep ? (
        <div className="award-flow-current">
          <div>
            <span className="section-kicker">Workflow step</span>
            <h2>Step {activeIndex + 1} of {steps.length}: {activeStep.label}</h2>
            <p>{activeStep.summary ?? activeStep.description}</p>
          </div>
          <div className="award-flow-current-meta">
            <FlowStatusBadge value={activeStep.statusLabel ?? defaultFlowStatusLabel(activeStatus)} />
            {flowCountLabel(activeStep) ? <span>{flowCountLabel(activeStep)}</span> : null}
          </div>
        </div>
      ) : null}
      <div
        className="wizard-step-progress award-flow-bar"
        role="tablist"
        aria-label={label}
        style={{ '--wizard-progress-ratio': progressRatio } as CSSProperties}
      >
        {steps.map((step, index) => {
          const status = flowStepStatus(active, step, index, activeIndex);
          const countLabel = flowCountLabel(step);
          const progressState = status === 'current' ? 'active' : status === 'complete' ? 'completed' : '';
          return (
            <button
              className={`wizard-progress-step award-flow-step ${progressState} ${status}${step.id === active ? ' active' : ''}`}
              type="button"
              role="tab"
              aria-selected={step.id === active}
              aria-disabled={status === 'locked'}
              title={step.lockReason?.message ?? step.description}
              onClick={() => onSelect(step.id)}
              key={step.id}
            >
              <strong>Step {index + 1}</strong>
              <span>
                <em>{step.label}</em>
                <small>{step.description}</small>
              </span>
              <b>{step.statusLabel ?? defaultFlowStatusLabel(status)}</b>
              {countLabel ? <i>{countLabel}</i> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LockedFlowStepPanel({
  title = 'This step is locked',
  reason,
  children
}: {
  title?: string;
  reason: FlowLockReason;
  children?: ReactNode;
}) {
  return (
    <section className="procurement-panel evaluation-panel award-flow-locked-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Flow lock</span>
          <h2>{title}</h2>
        </div>
        <span className="badge badge-warning">Locked</span>
      </div>
      <div className="scope-empty">{reason.message}</div>
      {children}
      {reason.actionLabel ? (
        <div className="inline-actions">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            data-navigate={reason.navigatePage ?? 'awarding-contracts'}
            data-route-search={reason.routeSearch ?? ''}
          >
            {reason.actionLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function FlowChangeAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="award-flow-alert" role="status" aria-live="polite">
      {message}
    </div>
  );
}
