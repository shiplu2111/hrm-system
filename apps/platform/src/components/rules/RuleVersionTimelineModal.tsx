import { Modal } from '@/components/ui/Modal';
import { RuleVersionTimeline } from './RuleVersionTimeline';

interface RuleVersionTimelineModalProps {
  open: boolean;
  onClose: () => void;
  countryId: string;
  ruleType: string;
  stateProvinceId?: string | null;
  onSelectVersion?: (versionId: string) => void;
}

export function RuleVersionTimelineModal({
  open,
  onClose,
  countryId,
  ruleType,
  stateProvinceId,
  onSelectVersion,
}: RuleVersionTimelineModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statutory Rule Version Timeline"
      size="xl"
    >
      <div className="max-h-[75vh] overflow-y-auto px-1 py-2">
        <RuleVersionTimeline
          countryId={countryId}
          ruleType={ruleType}
          stateProvinceId={stateProvinceId}
          onSelectVersion={(versionId) => {
            onSelectVersion?.(versionId);
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}
