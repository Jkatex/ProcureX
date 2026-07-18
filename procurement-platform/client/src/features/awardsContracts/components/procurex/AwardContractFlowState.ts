import { useEffect } from 'react';
import type { FlowStep } from '../../types';

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

export function flowStepFromSearch<TId extends string>(search: string, stepIds: readonly TId[], fallback: TId) {
  const step = new URLSearchParams(search).get('step') as TId | null;
  return step && stepIds.includes(step) ? step : fallback;
}

export function searchWithFlowStep(search: string, step: string) {
  const params = new URLSearchParams(search);
  params.set('step', step);
  return `?${params.toString()}`;
}
