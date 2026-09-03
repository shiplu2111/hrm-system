import { useCompany } from '@/context/CompanyContext';
import { Select } from '@/components/ui/Form';

export function CompanySelector() {
  const { companies, companyId, setCompanyId, loading } = useCompany();

  if (loading || companies.length <= 1) return null;

  return (
    <Select
      value={companyId ?? ''}
      onChange={(e) => setCompanyId(e.target.value)}
      className="w-auto h-9 text-sm"
      aria-label="Select company"
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
