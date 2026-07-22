/* Renders the awards Contracts Award Contract Flow UI while keeping page-specific presentation near its workflow data. */
import { type CSSProperties, type ReactNode } from 'react';
import type { FlowLockReason, FlowStep } from '../../types';
import { flowStepStatus } from './AwardContractFlowState';

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
  const progressRatio = steps.length <= 1 ? 0 : activeIndex / (steps.length - 1);
  return (
    <section className="award-flow-shell" aria-label={label}>
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
