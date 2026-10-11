import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { TrainingCourseRecord, TrainingSessionRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import {
  createTrainingSession,
  DELIVERY_MODE_LABELS,
  updateTrainingSession,
  type UpdateTrainingSessionInput,
} from '@/lib/training-api';
import { MAX_SESSION_DAYS, toLocalInput } from './training-ui';

function defaultStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function addMinutes(local: string, minutes: number): string {
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalInput(new Date(date.getTime() + minutes * 60_000));
}

function sameMinute(local: string, iso: string | null): boolean {
  if (!local || !iso) return !local && !iso;
  return new Date(local).getTime() === new Date(toLocalInput(iso)).getTime();
}

export function SessionFormModal({
  open,
  companyId,
  courses,
  defaultCourseId,
  session,
  onClose,
  onSaved,
}: {
  open: boolean;
  companyId: string;
  /** Courses that can be scheduled (active). Ignored when editing. */
  courses: TrainingCourseRecord[];
  defaultCourseId?: string;
  /** Editing when set; scheduling a new session otherwise. */
  session: TrainingSessionRecord | null;
  onClose: () => void;
  onSaved: (session: TrainingSessionRecord, created: boolean) => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [endTouched, setEndTouched] = useState(false);
  const [location, setLocation] = useState('');
  const [instructor, setInstructor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const course = useMemo(() => courses.find((row) => row.id === courseId) ?? null, [courses, courseId]);
  const scheduleLocked = session != null && session.status !== 'scheduled';

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (session) {
      setCourseId(session.courseId);
      setTitle(session.title ?? '');
      setStart(toLocalInput(session.scheduledStart));
      setEnd(session.scheduledEnd ? toLocalInput(session.scheduledEnd) : '');
      setEndTouched(true);
      setLocation(session.location ?? '');
      setInstructor(session.instructor ?? '');
      setNotes(session.notes ?? '');
      return;
    }
    const initialCourse = courses.find((row) => row.id === defaultCourseId) ?? courses[0] ?? null;
    const startValue = toLocalInput(defaultStart());
    setCourseId(initialCourse?.id ?? '');
    setTitle('');
    setStart(startValue);
    setEnd(addMinutes(startValue, initialCourse?.durationMinutes ?? 60));
    setEndTouched(false);
    setLocation('');
    setInstructor('');
    setNotes('');
  }, [open, session, courses, defaultCourseId]);

  useEffect(() => {
    if (session || endTouched || !start) return;
    setEnd(addMinutes(start, course?.durationMinutes ?? 60));
  }, [session, endTouched, start, course]);

  const windowError = useMemo(() => {
    if (!start) return 'Choose a start time.';
    const from = new Date(start).getTime();
    if (!end) return null;
    const to = new Date(end).getTime();
    if (to <= from) return 'The session must end after it starts.';
    if (to - from > MAX_SESSION_DAYS * 86_400_000) return `A session can last at most ${MAX_SESSION_DAYS} days.`;
    return null;
  }, [start, end]);

  const canSave = !!courseId && !windowError && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (session) {
        const input: UpdateTrainingSessionInput = {
          title: title.trim() || null,
          location: location.trim() || null,
          instructor: instructor.trim() || null,
          notes: notes.trim() || null,
        };
        if (!scheduleLocked && !sameMinute(start, session.scheduledStart)) {
          input.scheduledStart = new Date(start).toISOString();
        }
        if (!scheduleLocked && !sameMinute(end, session.scheduledEnd)) {
          input.scheduledEnd = end ? new Date(end).toISOString() : null;
        }
        onSaved(await updateTrainingSession(session.id, input), false);
      } else {
        const created = await createTrainingSession(companyId, {
          courseId,
          title: title.trim() || undefined,
          scheduledStart: new Date(start).toISOString(),
          scheduledEnd: end ? new Date(end).toISOString() : undefined,
          location: location.trim() || undefined,
          instructor: instructor.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        onSaved(created, true);
      }
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save the session'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={session ? 'Edit session' : 'Schedule session'}
      description={session ? session.courseTitle : 'Schedule a delivery of a catalog course, then enrol employees.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving ? 'Saving…' : session ? 'Save changes' : 'Schedule session'}
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
        {!session ? (
          <div>
            <Label htmlFor="session-course">Course</Label>
            {courses.length === 0 ? (
              <p className="text-sm text-secondary">Activate a course in the catalog before scheduling sessions.</p>
            ) : (
              <Select id="session-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} · {DELIVERY_MODE_LABELS[row.deliveryMode]}
                  </option>
                ))}
              </Select>
            )}
          </div>
        ) : null}
        <div>
          <Label htmlFor="session-title">Session name</Label>
          <Input
            id="session-title"
            value={title}
            maxLength={150}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={course?.title ?? session?.courseTitle ?? 'Defaults to the course title'}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="session-start">Starts</Label>
            <Input
              id="session-start"
              type="datetime-local"
              value={start}
              disabled={scheduleLocked}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="session-end">Ends</Label>
            <Input
              id="session-end"
              type="datetime-local"
              value={end}
              min={start || undefined}
              disabled={scheduleLocked}
              onChange={(e) => {
                setEnd(e.target.value);
                setEndTouched(true);
              }}
            />
          </div>
        </div>
        {scheduleLocked ? (
          <p className="text-xs text-muted">The date and time can only change before the session starts.</p>
        ) : windowError ? (
          <p className="text-xs text-error-600">{windowError}</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="session-location">Location</Label>
            <Input
              id="session-location"
              value={location}
              maxLength={200}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room, address or meeting link"
            />
          </div>
          <div>
            <Label htmlFor="session-instructor">Instructor</Label>
            <Input
              id="session-instructor"
              value={instructor}
              maxLength={120}
              onChange={(e) => setInstructor(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="session-notes">Notes</Label>
          <Textarea
            id="session-notes"
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
