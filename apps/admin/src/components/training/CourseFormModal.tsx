import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { TrainingCourseDeliveryMode, TrainingCourseRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import {
  createTrainingCourse,
  DELIVERY_MODE_LABELS,
  formatDurationMinutes,
  updateTrainingCourse,
} from '@/lib/training-api';

const MAX_DURATION_MINUTES = 100000;

export function CourseFormModal({
  open,
  companyId,
  course,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  companyId: string;
  /** Editing when set; creating otherwise. */
  course: TrainingCourseRecord | null;
  categories: string[];
  onClose: () => void;
  onSaved: (course: TrainingCourseRecord, created: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<TrainingCourseDeliveryMode>('instructor_led');
  const [duration, setDuration] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [activate, setActivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(course?.title ?? '');
    setDescription(course?.description ?? '');
    setCategory(course?.category ?? '');
    setDeliveryMode(course?.deliveryMode ?? 'instructor_led');
    setDuration(course?.durationMinutes ? String(course.durationMinutes) : '');
    setIsMandatory(course?.isMandatory ?? false);
    setActivate(true);
    setError(null);
  }, [open, course]);

  const durationValue = duration.trim() === '' ? null : Number(duration);
  const durationInvalid =
    durationValue !== null &&
    (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > MAX_DURATION_MINUTES);
  const canSave = title.trim().length > 0 && !durationInvalid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (course) {
        const saved = await updateTrainingCourse(course.id, {
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          deliveryMode,
          durationMinutes: durationValue,
          isMandatory,
        });
        onSaved(saved, false);
      } else {
        const saved = await createTrainingCourse(companyId, {
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          deliveryMode,
          durationMinutes: durationValue ?? undefined,
          isMandatory,
          status: activate ? 'active' : 'draft',
        });
        onSaved(saved, true);
      }
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save the course'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={course ? 'Edit course' : 'Add course'}
      description={
        course
          ? 'Changes apply to the catalog entry; scheduled sessions keep their own dates.'
          : 'Add a course to the company catalog. Sessions are scheduled from the course.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving ? 'Saving…' : course ? 'Save changes' : 'Add course'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}
        <div>
          <Label htmlFor="course-title">Title</Label>
          <Input
            id="course-title"
            value={title}
            maxLength={150}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Workplace Health & Safety Induction"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="course-description">Description</Label>
          <Textarea
            id="course-description"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What the course covers and who it’s for"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="course-category">Category</Label>
            <Input
              id="course-category"
              list="course-category-options"
              value={category}
              maxLength={60}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Compliance"
            />
            <datalist id="course-category-options">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="course-delivery">Delivery mode</Label>
            <Select
              id="course-delivery"
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as TrainingCourseDeliveryMode)}
            >
              {Object.entries(DELIVERY_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="course-duration">Duration (minutes)</Label>
            <Input
              id="course-duration"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DURATION_MINUTES}
              step={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Optional"
            />
            <p className={`mt-1 text-xs ${durationInvalid ? 'text-error-600' : 'text-muted'}`}>
              {durationInvalid
                ? 'Enter whole minutes between 1 and 100,000.'
                : durationValue
                  ? formatDurationMinutes(durationValue)
                  : 'Used as the default session length.'}
            </p>
          </div>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-primary">
              <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} />
              Mandatory training
            </label>
            {!course ? (
              <label className="flex items-center gap-2 text-sm text-primary">
                <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
                Ready to schedule (active)
              </label>
            ) : null}
          </div>
        </div>
        {!course && !activate ? (
          <p className="text-xs text-muted">Draft courses stay out of scheduling until you activate them.</p>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
