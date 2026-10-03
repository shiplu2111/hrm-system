import {
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Hash,
  Image,
  Paperclip,
  PenLine,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { CustomFieldType } from '@hrm/shared-types';

export const fieldTypeIcons = {
  text: Type,
  number: Hash,
  date: Calendar,
  dropdown: ChevronDownSquare,
  checkbox: CheckSquare,
  radio: CircleDot,
  file: Paperclip,
  image: Image,
  signature: PenLine,
} satisfies Record<CustomFieldType, LucideIcon>;
