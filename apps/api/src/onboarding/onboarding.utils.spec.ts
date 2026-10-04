import {
  isOnboardingTaskOverdue,
  nextCopyName,
  normalizeTemplateItemFields,
  resolveOnboardingDocumentStatus,
  summarizeOnboardingTasks,
  validateItemOrder,
} from './onboarding.utils';

describe('resolveOnboardingDocumentStatus', () => {
  const uploaded = { fileKey: 'k', verifiedAt: null, createdAt: new Date() };

  it('is null for tasks without a document type', () => {
    expect(
      resolveOnboardingDocumentStatus({
        documentTypeId: null,
        requiresVerification: true,
        document: uploaded,
      }),
    ).toBeNull();
  });

  it('reports missing, awaiting file, pending verification, verified and on file', () => {
    const base = { documentTypeId: 'type', requiresVerification: true };
    expect(resolveOnboardingDocumentStatus({ ...base, document: null })).toBe('missing');
    expect(
      resolveOnboardingDocumentStatus({ ...base, document: { ...uploaded, fileKey: null } }),
    ).toBe('awaiting_file');
    expect(resolveOnboardingDocumentStatus({ ...base, document: uploaded })).toBe(
      'pending_verification',
    );
    expect(
      resolveOnboardingDocumentStatus({
        ...base,
        document: { ...uploaded, verifiedAt: new Date() },
      }),
    ).toBe('verified');
    expect(
      resolveOnboardingDocumentStatus({
        documentTypeId: 'type',
        requiresVerification: false,
        document: uploaded,
      }),
    ).toBe('on_file');
  });
});

describe('isOnboardingTaskOverdue', () => {
  it('only flags pending tasks whose due date has passed', () => {
    expect(isOnboardingTaskOverdue({ status: 'pending', dueDate: '2026-10-01' }, '2026-10-04')).toBe(true);
    expect(isOnboardingTaskOverdue({ status: 'pending', dueDate: '2026-10-04' }, '2026-10-04')).toBe(false);
    expect(isOnboardingTaskOverdue({ status: 'completed', dueDate: '2026-10-01' }, '2026-10-04')).toBe(false);
    expect(isOnboardingTaskOverdue({ status: 'pending', dueDate: null }, '2026-10-04')).toBe(false);
    expect(
      isOnboardingTaskOverdue(
        { status: 'pending', dueDate: new Date('2026-10-03T00:00:00.000Z') },
        '2026-10-04',
      ),
    ).toBe(true);
  });
});

describe('summarizeOnboardingTasks', () => {
  const today = '2026-10-04';

  it('bases progress on required tasks and counts skipped as done', () => {
    const summary = summarizeOnboardingTasks(
      [
        { status: 'completed', isRequired: true, dueDate: null, documentStatus: 'verified' },
        { status: 'skipped', isRequired: true, dueDate: null, documentStatus: null },
        { status: 'pending', isRequired: true, dueDate: '2026-10-01', documentStatus: 'missing' },
        {
          status: 'pending',
          isRequired: true,
          dueDate: null,
          documentStatus: 'pending_verification',
        },
        { status: 'pending', isRequired: false, dueDate: '2026-09-30', documentStatus: null },
      ],
      today,
    );

    expect(summary).toEqual({
      progressPercent: 50,
      completedTaskCount: 2,
      totalTaskCount: 5,
      requiredTaskCount: 4,
      requiredCompletedCount: 2,
      overdueTaskCount: 2,
      documentsMissingCount: 1,
      documentsPendingVerificationCount: 1,
    });
  });

  it('falls back to all tasks when none are required, and handles an empty list', () => {
    expect(
      summarizeOnboardingTasks(
        [
          { status: 'completed', isRequired: false, dueDate: null, documentStatus: null },
          { status: 'pending', isRequired: false, dueDate: null, documentStatus: null },
        ],
        today,
      ).progressPercent,
    ).toBe(50);
    expect(summarizeOnboardingTasks([], today).progressPercent).toBe(0);
  });
});

describe('normalizeTemplateItemFields', () => {
  const all = {
    documentTypeId: 'doc',
    assetCategory: 'laptop' as const,
    policyDocumentUrl: '  https://intranet/handbook.pdf ',
  };

  it('keeps only the fields that apply to the task type', () => {
    expect(normalizeTemplateItemFields('document_collection', all)).toEqual({
      documentTypeId: 'doc',
      assetCategory: null,
      policyDocumentUrl: null,
    });
    expect(normalizeTemplateItemFields('policy_acceptance', all)).toEqual({
      documentTypeId: 'doc',
      assetCategory: null,
      policyDocumentUrl: 'https://intranet/handbook.pdf',
    });
    expect(normalizeTemplateItemFields('provisioning', all)).toEqual({
      documentTypeId: null,
      assetCategory: 'laptop',
      policyDocumentUrl: null,
    });
    expect(normalizeTemplateItemFields('manual_task', all)).toEqual({
      documentTypeId: null,
      assetCategory: null,
      policyDocumentUrl: null,
    });
  });

  it('turns a blank policy link into null', () => {
    expect(
      normalizeTemplateItemFields('policy_acceptance', { documentTypeId: 'doc', policyDocumentUrl: '  ' })
        .policyDocumentUrl,
    ).toBeNull();
  });
});

describe('validateItemOrder', () => {
  it('accepts a permutation of the existing items', () => {
    expect(validateItemOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual({ ok: true });
  });

  it('rejects duplicates, missing items and foreign items', () => {
    expect(validateItemOrder(['a', 'b'], ['a', 'a']).ok).toBe(false);
    expect(validateItemOrder(['a', 'b', 'c'], ['a', 'b']).ok).toBe(false);
    expect(validateItemOrder(['a', 'b'], ['a', 'x']).ok).toBe(false);
  });
});

describe('nextCopyName', () => {
  it('finds the first free copy name, ignoring case', () => {
    expect(nextCopyName('Standard', ['Standard'])).toBe('Copy of Standard');
    expect(nextCopyName('Standard', ['Standard', 'copy of standard'])).toBe('Copy of Standard (2)');
    expect(
      nextCopyName('Standard', ['Copy of Standard', 'Copy of Standard (2)']),
    ).toBe('Copy of Standard (3)');
  });
});
