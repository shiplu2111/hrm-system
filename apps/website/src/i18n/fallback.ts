import type { WebsiteLocale } from './types';

export type FallbackReason =
  | 'legal_document'
  | 'kb_content'
  | 'blog_article'
  | 'release_or_status_feed'
  | 'showcase'
  | 'untranslated_page';

export interface FallbackNoticeCopy {
  title: string;
  body: string;
  switchToEnglishLabel: string;
}

const FALLBACK_NOTICES_BN: Record<FallbackReason, FallbackNoticeCopy> = {
  legal_document: {
    title: 'এই আইনি নথির মূল পাঠ্য এখনো ইংরেজিতে রয়েছে',
    body: 'নেভিগেশন ও নথির বিবরণ বাংলায় দেখানো হয়েছে। আইনগত যাচাই সম্পন্ন না হওয়া পর্যন্ত মূল শর্তাবলি ইংরেজিতে প্রদর্শিত হচ্ছে।',
    switchToEnglishLabel: 'মূল ইংরেজি পৃষ্ঠা দেখুন',
  },
  kb_content: {
    title: 'এই সহায়তা নিবন্ধটি বর্তমানে শুধুমাত্র ইংরেজিতে উপলব্ধ',
    body: 'সহায়তা কেন্দ্রের মেনু ও নির্দেশিকা বাংলায় প্রদর্শিত হয়েছে, তবে এই গাইডের মূল বিষয়বস্তু এখনো বাংলায় অনূদিত হয়নি এবং ইংরেজিতে দেখানো হচ্ছে।',
    switchToEnglishLabel: 'ইংরেজি সংস্করণে যান',
  },
  blog_article: {
    title: 'এই ব্লগ নিবন্ধটি এখনো বাংলায় অনূদিত হয়নি',
    body: 'প্রবন্ধের শিরোনাম ও মূল পাঠ্য মূল ইংরেজি ভাষায় প্রদর্শিত হচ্ছে। বাংলা সংস্করণ প্রস্তুত হলে এখানে যুক্ত করা হবে।',
    switchToEnglishLabel: 'ইংরেজিতে পড়ুন',
  },
  release_or_status_feed: {
    title: 'ইঞ্জিনিয়ারিং ও স্ট্যাটাস বিবরণী ইংরেজিতে প্রকাশিত হয়',
    body: 'প্ল্যাটফর্মের নির্মাতা দল কর্তৃক প্রকাশিত রিলিজ নোট ও সিস্টেম ঘটনার বিবরণ মূল ইংরেজি ভাষায় প্রদর্শিত হচ্ছে।',
    switchToEnglishLabel: 'ইংরেজি পৃষ্ঠা দেখুন',
  },
  showcase: {
    title: 'ডিজাইন সিস্টেম রেফারেন্সের কিছু অংশ ইংরেজিতে রয়েছে',
    body: 'উপাদান প্রদর্শনীর কারিগরি নমুনা ও বিবরণী মূল ইংরেজিতে প্রদর্শিত হচ্ছে।',
    switchToEnglishLabel: 'ইংরেজি সংস্করণ দেখুন',
  },
  untranslated_page: {
    title: 'এই পৃষ্ঠাটি এখনো সম্পূর্ণভাবে বাংলায় অনূদিত হয়নি',
    body: 'অনুবাদ প্রক্রিয়াধীন থাকায় এই পৃষ্ঠার মূল বিষয়বস্তু ইংরেজিতে প্রদর্শিত হচ্ছে।',
    switchToEnglishLabel: 'ইংরেজিতে দেখুন',
  },
};

export function getFallbackNoticeCopy(
  locale: WebsiteLocale,
  reason: FallbackReason,
): FallbackNoticeCopy | null {
  if (locale === 'en') {
    return null;
  }
  return FALLBACK_NOTICES_BN[reason] ?? FALLBACK_NOTICES_BN.untranslated_page;
}
