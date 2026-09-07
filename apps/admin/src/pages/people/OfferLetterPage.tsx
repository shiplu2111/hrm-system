import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Send,
  Download,
  Loader2,
  Check,
  ThumbsUp,
  ThumbsDown,
  FileText,
} from 'lucide-react';
import type { OfferLetterRecord, OfferLetterTemplate } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import {
  getJobApplication,
  getOfferLetter,
  updateOfferLetter,
  generateOfferLetterPdf,
  submitOfferLetter,
  approveOfferLetter,
  rejectOfferLetter,
  sendOfferLetter,
  acceptOfferLetter,
  downloadOfferLetterPdf,
} from '@/lib/recruitment-api';
import {
  listDepartments,
  listDesignations,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function statusTone(
  status: OfferLetterRecord['status'],
): 'neutral' | 'warning' | 'success' | 'error' {
  if (status === 'accepted' || status === 'approved') return 'success';
  if (status === 'pending_approval' || status === 'sent') return 'warning';
  if (status === 'declined' || status === 'cancelled') return 'error';
  return 'neutral';
}

export function OfferLetterPage() {
  const { navigate, selectedApplicationId } = useNav();
  const [offer, setOffer] = useState<OfferLetterRecord | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [employmentTypes, setEmploymentTypes] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedApplicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const application = await getJobApplication(selectedApplicationId);
      setCandidateName(application.candidateName ?? 'Candidate');
      const [offerRow, depts, desigs, empTypes] = await Promise.all([
        getOfferLetter(selectedApplicationId),
        listDepartments(application.companyId),
        listDesignations(application.companyId),
        listEmploymentTypes(application.companyId),
      ]);
      setOffer(offerRow);
      setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
      setDesignations(desigs.map((d) => ({ id: d.id, name: d.name })));
      setEmploymentTypes(empTypes.map((e) => ({ id: e.id, name: e.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load offer letter');
    } finally {
      setLoading(false);
    }
  }, [selectedApplicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!offer || !selectedApplicationId) return;
    setSaving(true);
    setError(null);
    try {
      setOffer(
        await updateOfferLetter(selectedApplicationId, {
          template: offer.template,
          jobTitle: offer.jobTitle,
          departmentId: offer.departmentId,
          designationId: offer.designationId,
          employmentTypeId: offer.employmentTypeId,
          annualSalary: offer.annualSalary ?? undefined,
          currency: offer.currency,
          startDate: offer.startDate,
          reportingTo: offer.reportingTo ?? undefined,
          signingBonus: offer.signingBonus ?? undefined,
          equityNotes: offer.equityNotes ?? undefined,
          probationMonths: offer.probationMonths ?? undefined,
          expiryDate: offer.expiryDate,
          additionalTerms: offer.additionalTerms ?? undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: () => Promise<OfferLetterRecord>) => {
    setSaving(true);
    setError(null);
    try {
      setOffer(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedApplicationId) {
    return (
      <div className="p-6 text-secondary">
        Select a candidate from the recruitment pipeline first.
      </div>
    );
  }

  if (loading || !offer) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading offer letter…
      </div>
    );
  }

  const isDraft = offer.status === 'draft';
  const canEdit = isDraft;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => navigate('candidate-profile')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Candidate
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Offer Letter</h1>
          <p className="text-sm text-secondary mt-0.5">
            {candidateName} — {offer.jobTitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(offer.status)}>{offer.displayStatus}</Badge>
          {offer.fileKey && (
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => void downloadOfferLetterPdf(offer.id)}
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          )}
          {isDraft && (
            <>
              <Button variant="secondary" disabled={saving} onClick={() => void handleSave()}>
                Save Draft
              </Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() =>
                  void runAction(() => generateOfferLetterPdf(offer.id))
                }
              >
                <FileText className="h-4 w-4" /> Preview PDF
              </Button>
              <Button
                variant="primary"
                disabled={saving}
                onClick={() => void runAction(() => submitOfferLetter(offer.id))}
              >
                Submit for Approval
              </Button>
            </>
          )}
          {offer.status === 'pending_approval' && (
            <>
              <Button
                variant="primary"
                disabled={saving}
                onClick={() => void runAction(() => approveOfferLetter(offer.id))}
              >
                <ThumbsUp className="h-4 w-4" /> Approve
              </Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => void runAction(() => rejectOfferLetter(offer.id))}
              >
                <ThumbsDown className="h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {offer.status === 'approved' && (
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void runAction(() => sendOfferLetter(offer.id))}
            >
              <Send className="h-4 w-4" /> Send Offer
            </Button>
          )}
          {offer.status === 'sent' && (
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void runAction(() => acceptOfferLetter(offer.id))}
            >
              <Check className="h-4 w-4" /> Mark Accepted
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Offer Terms</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Template</Label>
              <Select
                value={offer.template}
                disabled={!canEdit}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    template: e.target.value as OfferLetterTemplate,
                  })
                }
              >
                <option value="standard">Standard Offer Letter</option>
                <option value="senior">Senior Role Offer</option>
                <option value="contract">Contract Offer</option>
                <option value="remote">Remote Worker Offer</option>
              </Select>
            </div>
            <div>
              <Label>Job Title</Label>
              <Input
                value={offer.jobTitle}
                disabled={!canEdit}
                onChange={(e) => setOffer({ ...offer, jobTitle: e.target.value })}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={offer.departmentId ?? ''}
                disabled={!canEdit}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    departmentId: e.target.value || null,
                  })
                }
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Designation</Label>
              <Select
                value={offer.designationId ?? ''}
                disabled={!canEdit}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    designationId: e.target.value || null,
                  })
                }
              >
                <option value="">Select designation</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select
                value={offer.employmentTypeId ?? ''}
                disabled={!canEdit}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    employmentTypeId: e.target.value || null,
                  })
                }
              >
                <option value="">Select type</option>
                {employmentTypes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Annual Salary</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!canEdit}
                  value={offer.annualSalary ?? ''}
                  onChange={(e) =>
                    setOffer({
                      ...offer,
                      annualSalary: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={offer.currency}
                  disabled={!canEdit}
                  onChange={(e) => setOffer({ ...offer, currency: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                disabled={!canEdit}
                value={offer.startDate}
                onChange={(e) => setOffer({ ...offer, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Reporting To</Label>
              <Input
                disabled={!canEdit}
                value={offer.reportingTo ?? ''}
                onChange={(e) =>
                  setOffer({ ...offer, reportingTo: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Signing Bonus</Label>
              <Input
                type="number"
                min={0}
                disabled={!canEdit}
                value={offer.signingBonus ?? ''}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    signingBonus: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div>
              <Label>Equity / Stock Options</Label>
              <Input
                disabled={!canEdit}
                value={offer.equityNotes ?? ''}
                onChange={(e) =>
                  setOffer({ ...offer, equityNotes: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Probation (months)</Label>
              <Input
                type="number"
                min={0}
                disabled={!canEdit}
                value={offer.probationMonths ?? ''}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    probationMonths: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div>
              <Label>Offer Expiry Date</Label>
              <Input
                type="date"
                disabled={!canEdit}
                value={offer.expiryDate ?? ''}
                onChange={(e) =>
                  setOffer({ ...offer, expiryDate: e.target.value || null })
                }
              />
            </div>
            <div>
              <Label>Additional Terms</Label>
              <Textarea
                rows={3}
                disabled={!canEdit}
                value={offer.additionalTerms ?? ''}
                onChange={(e) =>
                  setOffer({ ...offer, additionalTerms: e.target.value })
                }
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview Summary</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3 text-secondary">
            <p>
              Offer terms pre-fill from the job requisition and candidate record.
              After HR and leadership approve, a PDF is generated using the same
              server-side pipeline as payslips.
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <strong className="text-primary">Draft</strong> — edit terms, preview PDF
              </li>
              <li>
                <strong className="text-primary">Pending approval</strong> — workflow
                (HR Admin → Company Owner)
              </li>
              <li>
                <strong className="text-primary">Approved / Sent</strong> — download and
                send to candidate
              </li>
              <li>
                <strong className="text-primary">Accepted</strong> — enables one-click
                convert to employee with no re-entry
              </li>
            </ul>
            {offer.generatedAt && (
              <p className="text-xs text-muted">
                PDF generated: {new Date(offer.generatedAt).toLocaleString()}
              </p>
            )}
            {offer.acceptedAt && (
              <Badge tone="success">
                Accepted {new Date(offer.acceptedAt).toLocaleDateString()}
              </Badge>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
