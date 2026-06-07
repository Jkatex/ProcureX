import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { store } from '@/app/store';
import '@/i18n';
import { summaryCards } from './fixtures';
import { AwardingContractsProcurexPage } from './components/procurex/AwardingContractsProcurexPage';
import { AwardRecommendationProcurexPage } from './components/procurex/AwardRecommendationProcurexPage';
import { AwardResponseProcurexPage } from './components/procurex/AwardResponseProcurexPage';
import { ContractNegotiationProcurexPage } from './components/procurex/ContractNegotiationProcurexPage';
import { PostAwardTrackingProcurexPage } from './components/procurex/PostAwardTrackingProcurexPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderFlow(page: ReactNode, initialEntry: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {page}
        <LocationProbe />
      </MemoryRouter>
    </Provider>
  );
}

describe('awards and contracts empty lifecycle flow', () => {
  it('opens the requested dashboard queue from the URL with an empty state', async () => {
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awards-received');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Awards Received' })).toHaveClass('active'));

    const panel = container.querySelector<HTMLElement>('[data-tab="awards-received"].tab-content--visible');
    expect(panel).toBeInTheDocument();
    expect(within(panel!).getByText('No supplier awards have been received yet.')).toBeInTheDocument();
  });

  it('updates dashboard queue URLs from summary cards and side navigation', async () => {
    const user = userEvent.setup();
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await user.click(screen.getByRole('button', { name: 'Go to Closed Contracts tab' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=closed-contracts'));
    expect(screen.getByRole('tab', { name: 'Closed Contracts' })).toHaveClass('active');

    const sideNavAwardsReceived = container.querySelector<HTMLElement>(
      '.sidebar-nav [data-awarding-tab-jump="awards-received"]'
    );
    expect(sideNavAwardsReceived).toBeInTheDocument();
    await user.click(sideNavAwardsReceived!);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=awards-received'));
    expect(screen.getByRole('tab', { name: 'Awards Received' })).toHaveClass('active');
  });

  it('renders dashboard summary counts as zero', async () => {
    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    for (const card of summaryCards) {
      const summary = screen.getByRole('button', { name: `Go to ${card.label} tab` });
      expect(within(summary).getByText('0')).toBeInTheDocument();
    }
  });

  it('shows an empty urgent actions queue', async () => {
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=my-urgent-actions');
    const panel = container.querySelector<HTMLElement>('[data-tab="my-urgent-actions"].tab-content--visible');

    await waitFor(() => expect(panel).toBeInTheDocument());
    expect(within(panel!).getByText('No urgent award or contract actions yet.')).toBeInTheDocument();
  });

  it('renders empty child workspaces without selected records', async () => {
    renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation');
    expect(screen.getByText('No evaluation result is ready for awarding.')).toBeInTheDocument();

    renderFlow(<AwardResponseProcurexPage />, '/awards-contracts/award-response');
    expect(screen.getAllByText('No award selected').length).toBeGreaterThan(0);

    renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation');
    expect(screen.getByText('No contract is in progress.')).toBeInTheDocument();

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award');
    expect(screen.getByText('No post-award records are available yet.')).toBeInTheDocument();
  });
});
