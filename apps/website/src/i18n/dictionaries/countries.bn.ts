import type { DeepPartial } from '../types';
import type { countriesEn } from './countries.en';

export const countriesBn: DeepPartial<typeof countriesEn> = {
  index: {
    metaTitle: 'দেশভিত্তিক সমাধান — বহু-দেশীয় পেরোল ও কমপ্লায়েন্স',
    metaDescription:
      'CMSN-HR-এ সমর্থিত সক্রিয় দেশসমূহ, স্থানীয় মুদ্রা, বেতন চক্র এবং কনফিগারযোগ্য বিধিবদ্ধ নিয়মাবলি দেখুন।',
    eyebrow: 'গ্লোবাল কান্ট্রি ফ্রেমওয়ার্ক · মডিউল §০২',
    title: 'দেশভিত্তিক পেরোল, উপস্থিতি এবং বিধিবদ্ধ কমপ্লায়েন্স',
    subtitle:
      'প্রতিটি সক্রিয় দেশ একই সুনির্দিষ্ট কোরের ওপর চলে—স্থানীয় মুদ্রা, বেতন প্রদানের সময়সূচি, কর কাঠামো এবং সরকারি ছুটির ক্যালেন্ডার সহ।',
    selectorLabel: 'একটি সক্রিয় দেশ নির্বাচন করুন',
    selectorPlaceholder: 'দেশ নির্বাচন করুন...',
    selectorGoCta: 'দেশের নির্দেশিকা খুলুন',
    activeCountBadge: '{{count}}টি সক্রিয় দেশ উপলব্ধ',
    emptyTitle: 'এই মুহূর্তে কোনো সক্রিয় দেশ প্রকাশিত হয়নি',
    emptyDescription:
      'প্ল্যাটফর্ম কনসোল থেকে দেশের কনফিগারেশন পরিচালনা করা হয়। অনুগ্রহ করে পরে আবার দেখুন অথবা আপনার কাঙ্ক্ষিত দেশের জন্য আমাদের সাথে যোগাযোগ করুন।',
    emptyCta: 'ডেমো বুক করুন',
    cardCurrencyLabel: 'মুদ্রা',
    cardFrequenciesLabel: 'বেতন প্রদানের চক্র',
    cardStatutoryLabel: 'সমর্থিত বিধিবদ্ধ বিষয়',
    cardViewDetailsCta: 'বিস্তারিত দেখুন',
    cardTrialCta: 'ফ্রি ট্রায়াল শুরু করুন',
  },
  detail: {
    breadcrumbSolutions: 'সমাধান',
    breadcrumbCountries: 'দেশভিত্তিক',
    metaTitleTemplate: '{{country}} পেরোল, উপস্থিতি ও এইচআর কমপ্লায়েন্স',
    metaDescriptionTemplate:
      '{{country}} ({{currency}})-এর জন্য CMSN-HR সহায়তা: বেতন চক্র, আয়কর, {{socialSecurity}}, ছুটি ও সরকারি ছুটির ক্যালেন্ডার।',
    activeBadge: 'সক্রিয় দেশ',
    eyebrow: 'দেশভিত্তিক কমপ্লায়েন্স সমাধান · {{isoCode}}',
    headlineTemplate: '{{country}}-এর জন্য পেরোল, উপস্থিতি ও এইচআর কমপ্লায়েন্স',
    summaryTemplate:
      '{{currency}} মুদ্রায় {{country}}-এর বেতন চক্র পরিচালনা করুন, বিধিবদ্ধ ছুটি ও সরকারি ছুটির ক্যালেন্ডার প্রয়োগ করুন এবং চূড়ান্তকৃত পুরোনো বেতন রান সুরক্ষিত রাখুন।',
    facts: {
      currencyLabel: 'পেরোল মুদ্রা',
      frequenciesLabel: 'বেতন প্রদানের চক্র',
      statesLabel: 'বিভাগ / প্রদেশ',
      statesFallback: 'সারা দেশের সাধারণ নিয়ম',
      statesValueTemplate: '{{count}}টি নির্ধারিত',
      statusLabel: 'প্ল্যাটফর্ম অবস্থা',
      statusActiveValue: 'সক্রিয় ও সমর্থিত',
    },
    statutorySection: {
      eyebrow: 'বিধিবদ্ধ সক্ষমতা',
      titleTemplate: '{{country}}-এর জন্য সমর্থিত বিধিবদ্ধ কাঠামো',
      subtitle:
        'সব বিধিবদ্ধ নিয়ম কার্যকর তারিখসহ স্তরভিত্তিক ক্রমে সমাধান হয় (গ্লোবাল → দেশ → প্রদেশ → কোম্পানি নীতি → কর্মচারী চুক্তি)।',
      supportedLabel: 'সমর্থিত',
      configurableLabel: 'কনফিগারযোগ্য',
    },
    helpCenterNotice: {
      badge: 'লাইভ বিধিবদ্ধ রেফারেন্স নীতি',
      title: 'কর হার ও আইনি সীমা কেন আমাদের সহায়তা কেন্দ্রে রাখা হয়',
      description:
        'সরকারি নির্দেশনা অনুযায়ী কর স্ল্যাব ও অবদানের হার সময়মতো পরিবর্তিত হয়। তথ্য সর্বদা নির্ভুল রাখতে সুনির্দিষ্ট হার আমাদের সহায়তা কেন্দ্রে এবং প্ল্যাটফর্মের ভেতরে সংস্করণসহ সংরক্ষিত থাকে।',
      cta: 'সহায়তা কেন্দ্রের কমপ্লায়েন্স গাইড দেখুন',
    },
    otherCountries: {
      heading: 'অন্যান্য সক্রিয় দেশ দেখুন',
      subtitle: 'CMSN-HR-এ সমর্থিত অন্যান্য দেশীয় কাঠামোর মধ্যে পরিবর্তন করুন।',
    },
    cta: {
      eyebrowTemplate: '{{country}} পেরোল ও এইচআর চালু করুন',
      titleTemplate: '{{currency}} মুদ্রায় {{country}}-এর নিয়ম অনুযায়ী পেরোল চালাতে প্রস্তুত?',
      description:
        'প্রস্তুতকৃত দেশীয় ডিফল্ট নিয়ম নিয়ে ১৪ দিনের ফ্রি ট্রায়াল শুরু করুন অথবা আমাদের টিমের সাথে ডেমো দেখুন।',
      primaryLabel: 'ফ্রি ট্রায়াল শুরু করুন',
      secondaryLabel: 'ডেমো বুক করুন',
    },
  },
  frequencies: {
    monthly: 'মাসিক',
    weekly: 'সাপ্তাহিক',
    fortnightly: 'পাক্ষিক',
    'bi-weekly': 'দ্বি-সাপ্তাহিক',
    'semi-monthly': 'অর্ধ-মাসিক',
    semi_monthly: 'অর্ধ-মাসিক',
    'four-weekly': 'চার-সাপ্তাহিক',
    custom: 'কাস্টম',
  },
};
