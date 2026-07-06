import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { procurementApi } from '../../api';
import { TenderDetailsProcurexPage } from './TenderDetailsProcurexPage';

describe('TenderDetailsProcurexPage', () => {
  it('shows a not-found state for an invalid tender id', async () => {
    vi.spyOn(procurementApi, 'getTenderDetail').mockRejectedValue(new Error('Tender not found'));

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=session-draft-178333411768']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Tender not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Tenders' })).toHaveAttribute('href', '/procurement/my-tenders');
  });
});
