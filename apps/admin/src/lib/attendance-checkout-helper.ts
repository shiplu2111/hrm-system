import type { AttendanceDayRecord } from '@hrm/shared-types';

export interface EarlyLeaveReasonOption {
  id: string;
  label: string;
  labelBn: string;
}

export const EARLY_LEAVE_REASONS: EarlyLeaveReasonOption[] = [
  { id: 'illness', label: 'Medical / Feeling unwell', labelBn: 'শারীরিক অসুস্থতা / ডাক্তারের অ্যাপয়েন্টমেন্ট' },
  { id: 'personal', label: 'Personal or family emergency', labelBn: 'পারিবারিক বা ব্যক্তিগত জরুরি প্রয়োজন' },
  { id: 'official', label: 'Official offsite duty / Client visit', labelBn: 'অফিশিয়াল আউটডোর কাজ / ক্লায়েন্ট মিটিং' },
  { id: 'approved', label: 'Prior manager / supervisor approval', labelBn: 'ম্যানেজার বা সুপারভাইজারের পূর্বানুমতি' },
  { id: 'transport', label: 'Transport or commute issue', labelBn: 'যাতায়াত বা পরিবহন সংক্রান্ত সমস্যা' },
  { id: 'other', label: 'Other reasons', labelBn: 'অন্যান্য কারণ' },
];

export interface CheckoutAssessment {
  isEarlyLeave: boolean;
  earlyMinutes: number;
  earlyFormatted: string;
  isOvertime: boolean;
  overtimeMinutes: number;
  overtimeFormatted: string;
  grossMinutes: number;
  grossFormatted: string;
  breakMinutes: number;
  breakFormatted: string;
  netMinutes: number;
  netFormatted: string;
  isHalfDayRisk: boolean;
  halfDayThresholdMinutes: number;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  graceMinutes: number;
  standardMinutes: number;
  checkoutTime: Date;
  checkoutTimeDisplay: string;
}

export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseTimePart(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return { hours: d.getHours(), minutes: d.getMinutes() };
    }
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return { hours, minutes };
    }
  }
  return null;
}

export function assessCheckout(
  record: AttendanceDayRecord | null | undefined,
  overrideTimestamp?: string,
): CheckoutAssessment {
  let checkoutTime = new Date();
  if (overrideTimestamp && overrideTimestamp.trim()) {
    const parsed = new Date(overrideTimestamp.trim());
    if (!isNaN(parsed.getTime())) {
      checkoutTime = parsed;
    }
  }

  const shift = record?.shift;
  const shiftName = shift?.name ?? 'Assigned Shift';
  const shiftStartTime = shift?.startTime ?? '—';
  const shiftEndTime = shift?.endTime ?? '—';
  const graceMinutes = shift?.graceMinutes ?? 0;
  const standardMinutes = shift?.standardMinutes ?? 480;

  let isEarlyLeave = false;
  let earlyMinutes = 0;
  let isOvertime = false;
  let overtimeMinutes = 0;

  if (record?.date && shift?.endTime) {
    const dateParts = record.date.split('-').map(Number);
    if (dateParts.length === 3) {
      const [year, month, day] = dateParts;
      const endPart = parseTimePart(shift.endTime);
      const startPart = parseTimePart(shift.startTime);

      if (endPart) {
        const shiftEnd = new Date(year, month - 1, day, endPart.hours, endPart.minutes, 0, 0);
        if (startPart) {
          const shiftStart = new Date(year, month - 1, day, startPart.hours, startPart.minutes, 0, 0);
          if (shiftEnd <= shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
          }
        }

        const earlyThreshold = new Date(shiftEnd.getTime() - graceMinutes * 60_000);
        if (checkoutTime.getTime() < earlyThreshold.getTime()) {
          isEarlyLeave = true;
          earlyMinutes = Math.max(0, Math.round((shiftEnd.getTime() - checkoutTime.getTime()) / 60_000));
        } else if (checkoutTime.getTime() > shiftEnd.getTime()) {
          overtimeMinutes = Math.max(0, Math.round((checkoutTime.getTime() - shiftEnd.getTime()) / 60_000));
          if (overtimeMinutes > 0) {
            isOvertime = true;
          }
        }
      }
    }
  }

  let grossMinutes = 0;
  let breakMinutes = 0;

  if (record?.clockInAt) {
    const inDate = new Date(record.clockInAt);
    if (!isNaN(inDate.getTime())) {
      grossMinutes = Math.max(0, Math.round((checkoutTime.getTime() - inDate.getTime()) / 60_000));
    }

    if (Array.isArray(record.breaks)) {
      for (const b of record.breaks) {
        const bStart = new Date(b.startAt);
        const bEnd = b.endAt ? new Date(b.endAt) : checkoutTime;
        if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime()) && bEnd > bStart) {
          breakMinutes += Math.round((bEnd.getTime() - bStart.getTime()) / 60_000);
        }
      }
    }
  }

  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const halfDayThresholdMinutes = Math.round(standardMinutes / 2);
  const isHalfDayRisk = standardMinutes > 0 && netMinutes < halfDayThresholdMinutes;

  return {
    isEarlyLeave,
    earlyMinutes,
    earlyFormatted: formatDurationMinutes(earlyMinutes),
    isOvertime,
    overtimeMinutes,
    overtimeFormatted: formatDurationMinutes(overtimeMinutes),
    grossMinutes,
    grossFormatted: formatDurationMinutes(grossMinutes),
    breakMinutes,
    breakFormatted: formatDurationMinutes(breakMinutes),
    netMinutes,
    netFormatted: formatDurationMinutes(netMinutes),
    isHalfDayRisk,
    halfDayThresholdMinutes,
    shiftName,
    shiftStartTime,
    shiftEndTime,
    graceMinutes,
    standardMinutes,
    checkoutTime,
    checkoutTimeDisplay: checkoutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}
