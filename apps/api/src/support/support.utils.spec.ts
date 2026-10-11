import {
  supportNextStatuses,
  supportStatusAfterMessage,
  supportWorkflowStatus,
} from '@hrm/shared-types';
import { assertSupportTransition, supportStatusesFor } from './support.utils';

describe('support ticket workflow', () => {
  it('maps legacy statuses onto the three-step flow', () => {
    expect(supportWorkflowStatus('waiting')).toBe('in_progress');
    expect(supportWorkflowStatus('closed')).toBe('resolved');
    expect(supportWorkflowStatus('open')).toBe('open');
    expect(supportStatusesFor('in_progress')).toEqual(['in_progress', 'waiting']);
    expect(supportStatusesFor('resolved')).toEqual(['resolved', 'closed']);
  });

  it('allows forward moves, sending back to open, and reopening', () => {
    expect(supportNextStatuses('open')).toEqual(['in_progress', 'resolved']);
    expect(supportNextStatuses('in_progress')).toEqual(['open', 'resolved']);
    expect(supportNextStatuses('resolved')).toEqual(['in_progress']);
    expect(supportNextStatuses('closed')).toEqual(['in_progress']);
  });

  it('rejects resolved -> open and accepts no-op moves', () => {
    expect(() => assertSupportTransition('resolved', 'open')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
      }),
    );
    expect(() => assertSupportTransition('resolved', 'resolved')).not.toThrow();
    expect(() => assertSupportTransition('open', 'resolved')).not.toThrow();
    expect(() => assertSupportTransition('waiting', 'in_progress')).not.toThrow();
  });

  it('moves open tickets to in progress on the first staff reply', () => {
    const base = { fromStaff: true, isInternal: false, hasAssignee: false };
    expect(supportStatusAfterMessage({ ...base, status: 'open' })).toBe('in_progress');
    expect(supportStatusAfterMessage({ ...base, status: 'in_progress' })).toBeNull();
    expect(supportStatusAfterMessage({ ...base, status: 'resolved' })).toBeNull();
    expect(
      supportStatusAfterMessage({ ...base, status: 'open', isInternal: true }),
    ).toBeNull();
  });

  it('reopens resolved tickets when the requester replies', () => {
    const base = { fromStaff: false, isInternal: false };
    expect(
      supportStatusAfterMessage({ ...base, status: 'resolved', hasAssignee: true }),
    ).toBe('in_progress');
    expect(
      supportStatusAfterMessage({ ...base, status: 'closed', hasAssignee: false }),
    ).toBe('open');
    expect(
      supportStatusAfterMessage({ ...base, status: 'in_progress', hasAssignee: true }),
    ).toBeNull();
    expect(
      supportStatusAfterMessage({ ...base, status: 'waiting', hasAssignee: true }),
    ).toBe('in_progress');
  });
});
