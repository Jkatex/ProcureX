/* Supports the setup Tests ts client workflow with reusable logic kept close to the screens that consume it. */
import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;
