import { useState } from 'react';
import { ArrowLeft, FileText, Send, Download, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { candidates } from '@/data/mockData';

export function OfferLetterPage() {
  const { navigate } = useNav();
  const candidate = candidates[4]; // Mei Lin
  const [template, setTemplate] = useState('standard');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate('candidate-profile')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Candidate
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Generate Offer Letter</h1>
          <p className="text-sm text-secondary mt-0.5">For {candidate.name} — {candidate.role}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary"><Download className="h-4 w-4" /> Download PDF</Button>
          <Button variant="primary"><Send className="h-4 w-4" /> Send Offer</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Offer details form */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Offer Details</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Label>Template</Label>
                <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  <option value="standard">Standard Offer Letter</option>
                  <option value="senior">Senior Role Offer</option>
                  <option value="contract">Contract Offer</option>
                  <option value="remote">Remote Worker Offer</option>
                </Select>
              </div>
              <div>
                <Label>Job Title</Label>
                <Input defaultValue={candidate.role} />
              </div>
              <div>
                <Label>Department</Label>
                <Select><option>Engineering</option><option>Sales</option><option>Marketing</option></Select>
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select><option>Full-Time</option><option>Contract</option><option>Part-Time</option></Select>
              </div>
              <div>
                <Label>Annual Salary</Label>
                <Input type="text" defaultValue="$145,000" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" defaultValue="2024-09-15" />
              </div>
              <div>
                <Label>Reporting To</Label>
                <Input defaultValue="Sarah Chen, VP Engineering" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Additional Terms</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Label>Signing Bonus</Label>
                <Input type="text" placeholder="e.g. $10,000" />
              </div>
              <div>
                <Label>Equity / Stock Options</Label>
                <Input type="text" placeholder="e.g. 5,000 options" />
              </div>
              <div>
                <Label>Probation Period</Label>
                <Select><option>3 months</option><option>6 months</option><option>None</option></Select>
              </div>
              <div>
                <Label>Work Location</Label>
                <Select><option>San Francisco HQ</option><option>Remote</option><option>Hybrid</option></Select>
              </div>
              <div>
                <Label>Offer Expiry Date</Label>
                <Input type="date" defaultValue="2024-09-01" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Template preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Letter Preview</CardTitle>
              <Badge tone="accent">{template === 'standard' ? 'Standard Template' : template}</Badge>
            </CardHeader>
            <CardBody>
              <div className="surface border border-base rounded-lg p-8 lg:p-10 text-sm leading-relaxed space-y-4 min-h-[600px]">
                <div className="text-center pb-4 border-b border-base">
                  <div className="text-lg font-bold text-primary">ACME CORPORATION</div>
                  <div className="text-xs text-muted">1234 Market Street, San Francisco, CA 94103</div>
                </div>
                <div className="text-right text-xs text-muted">August 25, 2024</div>
                <div>
                  <div className="font-semibold text-primary">{candidate.name}</div>
                  <div className="text-muted">{candidate.email}</div>
                </div>
                <div className="font-semibold text-primary pt-2">Dear {candidate.name.split(' ')[0]},</div>
                <p className="text-secondary">
                  We are delighted to offer you the position of <strong className="text-primary">{candidate.role}</strong> at Acme Corporation. 
                  We were impressed with your qualifications and believe you will be a valuable addition to our team.
                </p>
                <div className="space-y-2">
                  <div className="font-semibold text-primary pt-2">Position Details:</div>
                  <ul className="text-secondary space-y-1 list-disc list-inside">
                    <li><strong>Job Title:</strong> {candidate.role}</li>
                    <li><strong>Department:</strong> Engineering</li>
                    <li><strong>Employment Type:</strong> Full-Time</li>
                    <li><strong>Reports To:</strong> Sarah Chen, VP Engineering</li>
                    <li><strong>Start Date:</strong> September 15, 2024</li>
                    <li><strong>Work Location:</strong> San Francisco HQ</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-primary pt-2">Compensation:</div>
                  <ul className="text-secondary space-y-1 list-disc list-inside">
                    <li><strong>Annual Salary:</strong> $145,000 USD (paid monthly)</li>
                    <li><strong>Signing Bonus:</strong> $10,000 (one-time, after 90 days)</li>
                    <li><strong>Equity:</strong> 5,000 stock options (4-year vesting)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-primary pt-2">Benefits:</div>
                  <ul className="text-secondary space-y-1 list-disc list-inside">
                    <li>25 days paid time off per year</li>
                    <li>Full health, dental, and vision insurance</li>
                    <li>401(k) with 5% company match</li>
                    <li>$2,000 annual learning & development budget</li>
                  </ul>
                </div>
                <p className="text-secondary pt-2">
                  This offer is valid until <strong>September 1, 2024</strong>. Please indicate your acceptance by signing below and returning this letter.
                </p>
                <p className="text-secondary">
                  We look forward to welcoming you to the Acme team.
                </p>
                <div className="pt-4">
                  <div className="text-muted text-xs">Sincerely,</div>
                  <div className="font-semibold text-primary mt-1">Alex Morgan</div>
                  <div className="text-xs text-muted">HR Director, Acme Corporation</div>
                </div>
                <div className="pt-6 border-t border-base grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-xs text-muted mb-8">Employee Signature</div>
                    <div className="border-t border-strong pt-1 text-xs text-muted">Date: ___________</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-8">Company Representative</div>
                    <div className="border-t border-strong pt-1 text-xs text-muted">Date: ___________</div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
