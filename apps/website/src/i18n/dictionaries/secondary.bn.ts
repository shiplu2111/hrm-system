import type { DeepPartial } from '../types';
import type { blogEn } from './blog.en';
import type { changelogEn } from './changelog.en';
import type { companyEn } from './company.en';
import type { customersEn } from './customers.en';
import type { helpEn } from './help.en';
import type { integrationsEn } from './integrations.en';
import type { leadsEn } from './leads.en';
import type { legalEn } from './legal.en';
import type { loginEn } from './login.en';
import type { securityEn } from './security.en';
import type { signupEn } from './signup.en';
import type { statusEn } from './status.en';

export const loginBn: DeepPartial<typeof loginEn> = {
  metaTitle: 'আপনার ওয়ার্কস্পেসে লগইন করুন',
  metaDescription:
    'আপনার প্রতিষ্ঠানের CMSN-HR পোর্টাল বা কর্মচারী অ্যাপে প্রবেশ করতে কোম্পানির সাবডোমেইন অথবা অফিসিয়াল ইমেইল লিখুন।',
  eyebrow: 'ওয়ার্কস্পেস প্রবেশ',
  title: 'CMSN-HR-এ সাইন ইন করুন',
  subtitle:
    'সঠিক লগইন পোর্টালে যেতে আপনার কোম্পানির ওয়ার্কস্পেস ঠিকানা অথবা অফিসিয়াল ইমেইল দিন।',
  destinationLabel: 'আপনি কোথায় সাইন ইন করতে চান?',
  destinations: [
    {
      id: 'portal',
      label: 'কোম্পানি ওয়ার্কস্পেস পোর্টাল',
      description: 'এইচআর, পেরোল ও ম্যানেজার লগইন',
    },
    {
      id: 'employee',
      label: 'কর্মচারী অ্যাপ',
      description: 'স্ব-সেবা, উপস্থিতি ও পে-স্লিপ',
    },
  ],
  identifierLabel: 'কোম্পানির সাবডোমেইন বা অফিসিয়াল ইমেইল',
  identifierPlaceholder: 'yourcompany অথবা alex@company.com',
  identifierHint:
    'আপনার ওয়ার্কস্পেস নাম (যেমন acme.cmsn-hr.com-এর জন্য acme) অথবা অফিসিয়াল ইমেইল লিখুন।',
  submitLabel: 'লগইনে এগিয়ে যান',
  submittingLabel: 'যাচাই করা হচ্ছে...',
  redirectingMessage: 'আপনার ওয়ার্কস্পেস সাইন-ইন পৃষ্ঠায় পাঠানো হচ্ছে...',
  validation: {
    identifierRequired: 'আপনার কোম্পানির সাবডোমেইন অথবা অফিসিয়াল ইমেইল লিখুন।',
    forgotEmailRequired: 'আপনার অফিসিয়াল ইমেইল ঠিকানা লিখুন।',
    forgotEmailInvalid: 'সঠিক ইমেইল ঠিকানা লিখুন।',
  },
  neutralUnknownTitle: 'ওয়ার্কস্পেস খোলা যায়নি',
  neutralUnknownBody: 'অনুগ্রহ করে ঠিকানাটি যাচাই করুন অথবা আপনার অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।',
  emailSentTitle: 'আপনার ইনবক্স দেখুন',
  emailSentBody:
    'এই ইমেইলের সাথে কোনো সক্রিয় ওয়ার্কস্পেস যুক্ত থাকলে আমরা সাইন-ইন লিংক পাঠিয়ে দিয়েছি। আপনার ইনবক্স দেখুন অথবা অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।',
  rateLimitError: 'অল্প সময়ে অনেকবার চেষ্টা করা হয়েছে। অনুগ্রহ করে এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।',
  genericError: 'এই মুহূর্তে এগিয়ে যাওয়া যাচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন।',
  forgotLinkLabel: 'কোম্পানির ঠিকানা ভুলে গেছেন?',
  forgotPanel: {
    title: 'আপনার কোম্পানির ঠিকানা খুঁজুন',
    description:
      'আপনার অফিসিয়াল ইমেইল দিন—এই ঠিকানার সাথে যুক্ত সব ওয়ার্কস্পেসের লগইন লিংক ইমেইলে পাঠানো হবে।',
    emailLabel: 'অফিসিয়াল ইমেইল ঠিকানা',
    emailPlaceholder: 'alex@company.com',
    honeypotLabel: 'ওয়েবসাইট (খালি রাখুন)',
    submitLabel: 'ওয়ার্কস্পেস লিংক পাঠান',
    submittingLabel: 'পাঠানো হচ্ছে...',
    cancelLabel: 'সাইন-ইনে ফিরে যান',
    confirmationTitle: 'আপনার ইমেইল দেখুন',
    confirmationBody:
      'এই ইমেইলের সাথে কোনো সক্রিয় ওয়ার্কস্পেস যুক্ত থাকলে আমরা সাইন-ইন লিংক পাঠিয়ে দিয়েছি।',
  },
  noAccountPrefix: 'এখনো ওয়ার্কস্পেস নেই?',
  startTrialLinkLabel: 'ফ্রি ট্রায়াল শুরু করুন',
};

export const signupBn: DeepPartial<typeof signupEn> = {
  metaTitle: 'ফ্রি ট্রায়াল শুরু করুন',
  metaDescription:
    'দেশভিত্তিক পেরোল নিয়ম, উপস্থিতি ও এইচআরআইএস সহ CMSN-HR-এ ফ্রি ট্রায়াল ওয়ার্কস্পেস চালু করুন। কোনো পেমেন্ট কার্ড প্রয়োজন নেই।',
  eyebrow: 'স্ব-সেবা ওয়ার্কস্পেস সেটআপ',
  title: 'আপনার {{trialDays}} দিনের ফ্রি ট্রায়াল শুরু করুন',
  subtitle: 'কয়েক মিনিটের মধ্যে আপনার দেশের নিয়ম অনুযায়ী আলাদা ওয়ার্কস্পেস চালু করুন।',
  titleFallback: 'আপনার ফ্রি ট্রায়াল শুরু করুন',
  trialCard: {
    headingWithDays: 'আপনার {{trialDays}} দিনের {{planName}} ট্রায়ালে যা থাকছে',
    headingDefault: 'আপনার {{planName}} ট্রায়ালে যা থাকছে',
    noCardBadge: 'পেমেন্ট কার্ডের প্রয়োজন নেই',
    limitsLabel: 'ট্রায়াল চলাকালীন ওয়ার্কস্পেস সীমা',
    featuresLabel: 'অন্তর্ভুক্ত সুবিধাসমূহ',
    unlimitedText: 'সীমাহীন',
    upToText: 'সর্বোচ্চ {{value}}',
  },
  form: {
    heading: 'আপনার ওয়ার্কস্পেস তৈরি করুন',
    companyNameLabel: 'কোম্পানি বা প্রতিষ্ঠানের নাম',
    countryLabel: 'প্রধান পরিচালন দেশ',
    countryPlaceholder: 'দেশ নির্বাচন করুন',
    ownerNameLabel: 'আপনার পূর্ণ নাম',
    workEmailLabel: 'অফিসিয়াল ইমেইল ঠিকানা',
    passwordLabel: 'পাসওয়ার্ড তৈরি করুন',
    passwordHint: 'কমপক্ষে ৮টি অক্ষর ব্যবহার করুন (অক্ষর ও সংখ্যা সহ)।',
    subdomainLabel: 'ওয়ার্কস্পেস ওয়েব ঠিকানা (সাবডোমেইন)',
    captchaLabel: 'মানব যাচাইকরণ',
    captchaRefreshText: 'নতুন প্রশ্ন',
    captchaPlaceholder: 'উত্তর লিখুন',
    termsPrefix: 'আমি সম্মত হচ্ছি যে',
    termsLinkLabel: 'সেবার শর্তাবলি',
    termsAndText: 'এবং',
    privacyLinkLabel: 'গোপনীয়তা নীতি',
    termsVersionNote: '(সংস্করণ {{version}})',
    marketingConsentLabel: 'অতিরিক্ত ক্যাম্পেইন তথ্য ও অনবোর্ডিং আপডেট গ্রহণে সম্মতি (ঐচ্ছিক)',
    submitLabel: 'ট্রায়াল ওয়ার্কস্পেস তৈরি করুন',
    submittingLabel: 'যাচাইকরণ ইমেইল পাঠানো হচ্ছে...',
    alreadyHaveAccountPrefix: 'ইতিমধ্যেই ওয়ার্কস্পেস আছে?',
    alreadyHaveAccountLink: 'ওয়ার্কস্পেসে লগইন করুন',
  },
  submitted: {
    badge: 'ইমেইল যাচাই প্রয়োজন',
    title: 'আপনার অফিসিয়াল ইমেইল দেখুন',
    backHomeLabel: 'হোম পেজে ফিরে যান',
    exploreFeaturesLabel: 'অপেক্ষার সময় ফিচারগুলো দেখুন',
  },
  verify: {
    metaTitle: 'আপনার ইমেইল যাচাই করুন',
    metaDescription: 'নতুন CMSN-HR ওয়ার্কস্পেস চালু করতে আপনার ইমেইল ঠিকানা যাচাই করুন।',
    verifyingBadge: 'ইমেইল যাচাইকরণ',
    verifyingTitle: 'আপনার ইমেইল ঠিকানা যাচাই করা হচ্ছে...',
    backHomeCta: 'হোমে ফিরে যান',
  },
  setup: {
    metaTitle: 'ওয়ার্কস্পেস প্রস্তুত করা হচ্ছে',
    metaDescription: 'আপনার নতুন CMSN-HR ওয়ার্কস্পেসের স্বয়ংক্রিয় সেটআপ অগ্রগতি।',
    progressBadge: 'স্বয়ংক্রিয় সেটআপ',
    progressTitle: 'আপনার ওয়ার্কস্পেস তৈরি করা হচ্ছে...',
    readyBadge: 'সেটআপ সম্পন্ন',
    readyTitle: 'আপনার ওয়ার্কস্পেস প্রস্তুত',
    readyCta: 'ওয়ার্কস্পেস লগইনে যান',
  },
};

export const leadsBn: DeepPartial<typeof leadsEn> = {
  demo: {
    metaTitle: 'ডেমো বুক করুন',
    metaDescription:
      'CMSN-HR পেরোল নিয়ম, অফলাইন উপস্থিতি, ছুটি নীতি ও নিরাপত্তা নিয়ন্ত্রণের ওপর একটি নির্দেশিত প্রোডাক্ট ডেমোর জন্য আবেদন করুন।',
    eyebrow: 'নির্দেশিত প্রোডাক্ট ডেমো',
    title: 'CMSN-HR কীভাবে আপনার পেরোল ও কর্মী ব্যবস্থাপনা সহজ করে দেখুন',
    subtitle:
      'আপনার দলের আকার, দেশ ও অগ্রাধিকারগুলো জানান যাতে আমরা প্রাসঙ্গিক ডেমো সেশন সাজাতে পারি।',
    highlights: [
      'দেশভিত্তিক কর, ছুটি ও ওভারটাইম নিয়ম ইঞ্জিন',
      'সার্ভার যাচাইকরণসহ অফলাইন-সক্ষম মোবাইল উপস্থিতি',
      'অপরিবর্তনীয় নিরীক্ষা লগসহ সুনির্দিষ্ট পেরোল রান',
    ],
    form: {
      heading: 'ডেমোর জন্য অনুরোধ করুন',
      nameLabel: 'আপনার পূর্ণ নাম',
      workEmailLabel: 'অফিসিয়াল ইমেইল ঠিকানা',
      companyLabel: 'কোম্পানি বা প্রতিষ্ঠানের নাম',
      countryLabel: 'প্রধান দেশ',
      countryPlaceholder: 'দেশ নির্বাচন করুন',
      employeeBandLabel: 'আনুমানিক দলের আকার',
      employeeBandPlaceholder: 'কর্মচারী সংখ্যা নির্বাচন করুন',
      focusTopicsLabel: 'আপনি কী কী দেখতে চান?',
      messageLabel: 'অতিরিক্ত প্রশ্ন বা কর্মপ্রবাহের বিবরণ',
      captchaLabel: 'মানব যাচাইকরণ',
      captchaRefreshText: 'নতুন প্রশ্ন',
      captchaPlaceholder: 'উত্তর লিখুন',
      privacyLinkLabel: 'গোপনীয়তা নীতি',
      submitLabel: 'ডেমোর অনুরোধ পাঠান',
      submittingLabel: 'অনুরোধ পাঠানো হচ্ছে...',
    },
    thankYou: {
      metaTitle: 'ডেমোর অনুরোধ গৃহীত হয়েছে',
      metaDescription: 'CMSN-HR প্রোডাক্ট ডেমোর অনুরোধ করার জন্য ধন্যবাদ।',
      badge: 'অনুরোধ গৃহীত',
      title: 'ডেমো অনুরোধ করার জন্য ধন্যবাদ',
      exploreFeaturesCta: 'ফিচারগুলো দেখুন',
      viewPricingCta: 'প্ল্যান ও মূল্য তুলনা করুন',
    },
  },
  contact: {
    metaTitle: 'যোগাযোগ ও সেলস',
    metaDescription:
      'CMSN-HR সেলস, পার্টনারশিপ বা সাধারণ তথ্যের জন্য যোগাযোগ করুন অথবা বর্তমান গ্রাহকদের জন্য সহায়তা কেন্দ্র দেখুন।',
    eyebrow: 'যোগাযোগ করুন',
    title: 'আপনার দলকে কীভাবে সাহায্য করতে পারি?',
    subtitle: 'আপনার প্রশ্নের ধরন নির্বাচন করুন যাতে সঠিক দল দ্রুত সাড়া দিতে পারে।',
    topicHeading: 'আলোচনার বিষয় নির্বাচন করুন',
    topics: [
      {
        id: 'sales',
        label: 'সেলস টিমের সাথে কথা বলুন',
        shortDescription: 'প্ল্যান, কাস্টম কোটেশন ও এন্টারপ্রাইজ রোলআউট',
      },
      {
        id: 'support',
        label: 'বর্তমান গ্রাহক সহায়তা',
        shortDescription: 'অ্যাকাউন্ট সহায়তা, পেরোল ও কারিগরি টিকিট',
      },
      {
        id: 'partnership',
        label: 'পার্টনারশিপ',
        shortDescription: 'ইন্টিগ্রেশন, পেরোল পার্টনার ও পরামর্শক প্রতিষ্ঠান',
      },
      {
        id: 'other',
        label: 'অন্যান্য জিজ্ঞাসা',
        shortDescription: 'ক্যারিয়ার, মিডিয়া, প্রকিউরমেন্ট বা সাধারণ তথ্য',
      },
    ],
    forms: {
      salesHeading: 'সেলস টিমে বার্তা পাঠান',
      partnershipHeading: 'পার্টনারশিপ ও ইন্টিগ্রেশন জিজ্ঞাসা',
      otherHeading: 'সাধারণ জিজ্ঞাসা',
      nameLabel: 'আপনার পূর্ণ নাম',
      workEmailLabel: 'অফিসিয়াল ইমেইল ঠিকানা',
      companyRequiredLabel: 'কোম্পানি বা প্রতিষ্ঠানের নাম',
      companyOptionalLabel: 'কোম্পানি বা প্রতিষ্ঠান (ঐচ্ছিক)',
      countryRequiredLabel: 'প্রধান পরিচালন দেশ',
      countryOptionalLabel: 'দেশ / অঞ্চল (ঐচ্ছিক)',
      countryPlaceholder: 'দেশ নির্বাচন করুন',
      employeeBandLabel: 'আনুমানিক দলের আকার',
      employeeBandPlaceholder: 'কর্মচারী সংখ্যা নির্বাচন করুন',
      captchaLabel: 'মানব যাচাইকরণ',
      captchaRefreshText: 'নতুন প্রশ্ন',
      captchaPlaceholder: 'উত্তর লিখুন',
      privacyLinkLabel: 'গোপনীয়তা নীতি',
      submitSalesLabel: 'সেলস টিমে পাঠান',
      submitMessageLabel: 'বার্তা পাঠান',
      submittingLabel: 'পাঠানো হচ্ছে...',
    },
    confirmation: {
      badge: 'বার্তা গৃহীত হয়েছে',
      salesTitle: 'আপনার সেলস জিজ্ঞাসা আমাদের টিমের কাছে পৌঁছেছে',
      defaultTitle: 'CMSN-HR-এ যোগাযোগ করার জন্য ধন্যবাদ',
      bookDemoCta: 'নির্দেশিত ডেমো দেখতে চান? ডেমো বুক করুন',
      anotherInquiryCta: 'আরেকটি জিজ্ঞাসা পাঠান',
      viewPricingCta: 'প্ল্যান ও মূল্য দেখুন',
    },
  },
};

export const helpBn: DeepPartial<typeof helpEn> = {
  metaTitle: 'সহায়তা কেন্দ্র',
  metaDescription:
    'CMSN-HR-এ অনবোর্ডিং, নিয়ম নির্ধারণ, পেরোল এবং অফলাইন উপস্থিতি বিষয়ক সর্বজনীন গাইড ও নির্দেশিকা দেখুন।',
  eyebrow: 'সর্বজনীন জ্ঞানভাণ্ডার',
  title: 'আজ আমরা আপনাকে কীভাবে সাহায্য করতে পারি?',
  subtitle: 'সেটআপ গাইড, সমস্যার সমাধান এবং ধাপে ধাপে প্রোডাক্ট ডকুমেন্টেশন খুঁজুন।',
  searchPlaceholder: 'গাইড খুঁজুন (যেমন পেরোল সমন্বয়, অফলাইন সিঙ্ক)...',
  searchButton: 'অনুসন্ধান',
  clearSearch: 'মুছুন',
  searchingLabel: 'সহায়তা কেন্দ্রে খোঁজা হচ্ছে...',
  searchResultsHeading: '“{{query}}” এর অনুসন্ধান ফলাফল',
  searchNoResultsTitle: 'কোনো মিল খুঁজে পাওয়া যায়নি',
  categoriesHeading: 'বিষয় অনুযায়ী ব্রাউজ করুন',
  categoriesSubtitle: 'কাজের ধারা অনুযায়ী সাজানো সর্বজনীন ডকুমেন্টেশন।',
  articleCountSingular: '{{count}}টি গাইড',
  articleCountPlural: '{{count}}টি গাইড',
  popularHeading: 'জনপ্রিয় গাইডসমূহ',
  popularSubtitle: 'নতুন ও বর্তমান দলগুলোর জন্য সবচেয়ে বেশি পঠিত নির্দেশিকা।',
  readArticleLabel: 'গাইড পড়ুন',
  readTimeLabel: '{{minutes}} মিনিট পাঠ',
  updatedLabel: 'হালনাগাদ {{date}}',
  breadcrumbs: {
    home: 'হোম',
    helpCenter: 'সহায়তা কেন্দ্র',
  },
  categoryPage: {
    emptyTitle: 'এই বিভাগে এখনো কোনো সর্বজনীন গাইড নেই',
    backToHelp: 'সহায়তা কেন্দ্রে ফিরে যান',
  },
  articlePage: {
    authorLabel: 'লেখক: {{author}}',
    stepPrefix: 'ধাপ {{step}}',
    relatedHeading: 'সংশ্লিষ্ট গাইডসমূহ',
    feedbackHeading: 'এই নিবন্ধটি কি আপনার কাজে এসেছে?',
    feedbackYes: 'হ্যাঁ, উপকারী',
    feedbackNo: 'না, উন্নতি প্রয়োজন',
    feedbackThanksYes: 'আপনার মতামতের জন্য ধন্যবাদ!',
    feedbackStats: '{{yes}} জন উপকারী বলেছেন · {{no}} জন অনুপকারী বলেছেন',
    existingCustomerCta: 'সহায়তার মাধ্যম দেখুন',
    logInCta: 'ওয়ার্কস্পেসে লগইন করুন',
  },
};

export const blogBn: DeepPartial<typeof blogEn> = {
  metaTitle: 'ব্লগ',
  metaDescription:
    'CMSN-HR টিমের প্রোডাক্ট ইঞ্জিনিয়ারিং নোট, পেরোল কমপ্লায়েন্স গাইড ও কর্মী ব্যবস্থাপনা বিশ্লেষণ।',
  eyebrow: 'CMSN-HR জার্নাল',
  title: 'প্রোডাক্ট, পেরোল ও কমপ্লায়েন্স বিশ্লেষণ',
  subtitle: 'সুনির্দিষ্ট পেরোল কাঠামো, দেশভিত্তিক নিয়োগ নিয়ম এবং অফলাইন উপস্থিতি প্রযুক্তি নিয়ে গভীর আলোচনা।',
  rssLabel: 'RSS ফিড',
  allCategoriesLabel: 'সব বিষয়',
  readMoreLabel: 'নিবন্ধ পড়ুন',
  readTimeLabel: '{{minutes}} মিনিট পাঠ',
  byAuthor: 'লেখক: {{author}}',
  emptyTitle: 'এখনো কোনো ব্লগ পোস্ট প্রকাশিত হয়নি',
  emptyBrowseHelpCta: 'সহায়তা কেন্দ্রের গাইড দেখুন',
  paginationPrevious: 'পূর্ববর্তী',
  paginationNext: 'পরবর্তী',
  paginationStatus: 'পৃষ্ঠা {{page}} / {{totalPages}}',
  breadcrumbs: {
    home: 'হোম',
    blog: 'ব্লগ',
  },
  share: {
    heading: 'নিবন্ধটি শেয়ার করুন',
    copyLink: 'লিংক কপি করুন',
    copied: 'লিংক কপি হয়েছে',
    shareLinkedIn: 'LinkedIn',
    shareX: 'X',
    shareEmail: 'ইমেইল',
  },
  relatedHeading: 'সংশ্লিষ্ট নিবন্ধসমূহ',
  subscribe: {
    heading: 'ইমেইলে নতুন নিবন্ধ পান',
    description: 'নতুন পেরোল, কমপ্লায়েন্স ও প্রোডাক্ট নিবন্ধ প্রকাশিত হলে বিজ্ঞপ্তি পান।',
    emailLabel: 'অফিসিয়াল ইমেইল ঠিকানা',
    privacyLinkLabel: 'গোপনীয়তা নীতি',
    submitLabel: 'সাবস্ক্রাইব করুন',
    submittingLabel: 'সাবস্ক্রাইব হচ্ছে...',
    confirmationTitle: 'সাবস্ক্রিপশন নিশ্চিত হয়েছে',
  },
};

export const changelogBn: DeepPartial<typeof changelogEn> = {
  metaTitle: 'প্রোডাক্ট আপডেট',
  metaDescription:
    'CMSN-HR মাল্টি-টেন্যান্ট পেরোল, উপস্থিতি ও প্ল্যাটফর্ম সেবার রিলিজ নোট ও প্রকাশিত পরিবর্তনসমূহ।',
  eyebrow: 'রিলিজ চেঞ্জলগ',
  title: 'প্রোডাক্ট আপডেট',
  subtitle: 'CMSN-HR-এ যুক্ত নতুন সুবিধা, মানোন্নয়ন এবং সমস্যার সমাধানের তারিখভিত্তিক তালিকা।',
  rssLabel: 'RSS ফিড',
  filterAllLabel: 'সব আপডেট',
  tags: {
    New: 'নতুন',
    Improved: 'উন্নত',
    Fixed: 'সমাধানকৃত',
  },
  emptyForTag: 'নির্বাচিত ট্যাগে কোনো আপডেট পাওয়া যায়নি।',
  showAllLabel: 'সব আপডেট দেখুন',
  shippedNote: 'তালিকাভুক্ত প্রতিটি পরিবর্তন মূল প্ল্যাটফর্ম ও ওয়েবসাইটে যাচাইকৃত ও প্রকাশিত।',
};

export const statusBn: DeepPartial<typeof statusEn> = {
  meta: {
    title: 'সিস্টেম স্ট্যাটাস',
    description:
      'CMSN-HR এপিআই, ওয়েব অ্যাপ, মোবাইল সিঙ্ক ও নোটিফিকেশন সেবার লাইভ অবস্থা এবং ৯০ দিনের আপটাইম ইতিহাস।',
  },
  hero: {
    eyebrow: 'সেবার নির্ভরযোগ্যতা',
    title: 'সিস্টেম স্ট্যাটাস',
    subtitle: 'মূল গ্রাহক সেবাসমূহের বর্তমান অবস্থা, ৯০ দিনের কার্যকারিতা এবং স্টাফ-প্রকাশিত ঘটনার বিবরণী।',
  },
  overall: {
    operational: 'সব সিস্টেম স্বাভাবিকভাবে সচল',
    degraded: 'আংশিক ধীরগতি পরিলক্ষিত হয়েছে',
    outage: 'সেবা বিঘ্নিত হয়েছে',
    maintenance: 'নির্ধারিত রক্ষণাবেক্ষণ চলমান',
    operationalSubtitle: 'সকল মূল গ্রাহক সেবা স্বাভাবিকভাবে কাজ করছে।',
    lastUpdatedLabel: 'সর্বশেষ যাচাই',
    autoRefreshNote: 'প্রতি {{seconds}} সেকেন্ডে স্বয়ংক্রিয়ভাবে হালনাগাদ হয়',
    refreshButton: 'এখনই রিফ্রেশ করুন',
    refreshingButton: 'রিফ্রেশ হচ্ছে…',
  },
  states: {
    operational: 'সচল',
    degraded: 'ধীরগতি',
    outage: 'বিঘ্নিত',
    maintenance: 'রক্ষণাবেক্ষণ',
  },
  components: {
    heading: 'সেবাভিত্তিক বর্তমান অবস্থা',
    subtitle: '৯০ দিনের দৈনিক বারগুলোতে যাচাইকৃত ঘটনা ও রক্ষণাবেক্ষণের ইতিহাস প্রতিফলিত হয়েছে।',
    uptimeSuffix: 'আপটাইম (৯০ দিন)',
    ninetyDaysAgo: '৯০ দিন আগে',
    today: 'আজ',
    legend: {
      operational: 'সচল',
      degraded: 'ধীরগতি',
      maintenance: 'রক্ষণাবেক্ষণ',
      outage: 'বিঘ্নিত',
    },
  },
  incidents: {
    activeHeading: 'চলমান ঘটনাবলি',
    activeEmpty: 'এই মুহূর্তে কোনো চলমান বিঘ্ন নেই।',
    historyHeading: 'পূর্ববর্তী ঘটনার ইতিহাস',
    historySubtitle: 'প্ল্যাটফর্ম স্টাফ দ্বারা প্রকাশিত পূর্ববর্তী ঘটনা ও সমাধানের সময়রেখা।',
    historyEmpty: 'সাম্প্রতিক সময়ে কোনো ঘটনা রেকর্ড হয়নি।',
    startedLabel: 'শুরু',
    resolvedLabel: 'সমাধান',
    durationLabel: 'সময়কাল',
    durationOngoing: 'চলমান',
    durationMinutes: '{{minutes}} মিনিট',
    timelineHeading: 'অবস্থার আপডেট',
  },
  helpFooter: {
    question: 'আপনার ওয়ার্কস্পেসে কোনো সমস্যার সম্মুখীন হচ্ছেন?',
    helpCta: 'সহায়তা কেন্দ্রে যান',
    contactCta: 'সাপোর্টে যোগাযোগ করুন',
  },
};

export const integrationsBn: DeepPartial<typeof integrationsEn> = {
  meta: {
    title: 'ইন্টিগ্রেশন ডিরেক্টরি',
    description:
      'CMSN-HR সমর্থিত লাইভ অ্যাকাউন্টিং, পেমেন্ট, নোটিফিকেশন, উপস্থিতি ডিভাইস এবং ডেভেলপার এপিআই ইন্টিগ্রেশন দেখুন।',
  },
  hero: {
    eyebrow: 'সংযুক্ত ইকোসিস্টেম',
    title: 'পরিচ্ছন্ন ড্রাইভার কাঠামোয় নির্মিত ইন্টিগ্রেশন',
    subtitle:
      'আজ যেসব অ্যাকাউন্টিং, পেমেন্ট, নোটিফিকেশন, উপস্থিতি ডিভাইস ও এপিআই সংযোগ লাইভ রয়েছে—এবং যেগুলো সামনে আসছে তা দেখুন।',
    liveSummaryLabel: '{{live}}টি লাইভ ইন্টিগ্রেশন',
    comingSoonSummaryLabel: '{{comingSoon}}টি শীঘ্রই আসছে',
  },
  filters: {
    categoryLabel: 'বিভাগ',
    statusLabel: 'উপলব্ধতা',
    allCategories: 'সব বিভাগ',
    allStatuses: 'সবগুলো',
    statusLive: 'লাইভ',
    statusComingSoon: 'শীঘ্রই আসছে',
    emptyMessage: 'নির্বাচিত ফিল্টারের সাথে কোনো ইন্টিগ্রেশন মেলেনি।',
    resetButton: 'ফিল্টার রিসেট করুন',
    categories: {
      accounting: 'অ্যাকাউন্টিং ও জিএল',
      payments: 'পেমেন্ট ও ব্যাংকিং',
      notifications: 'বিজ্ঞপ্তি (নোটিফিকেশন)',
      attendance: 'উপস্থিতি ও ডিভাইস',
      developer: 'API, ওয়েবহুক ও স্টোরেজ',
      calendar_sso: 'ক্যালেন্ডার ও এন্টারপ্রাইজ SSO',
    },
  },
  card: {
    statusLive: 'লাইভ',
    statusComingSoon: 'শীঘ্রই আসছে',
  },
  cta: {
    eyebrow: 'কাস্টম সংযোগ প্রয়োজন?',
    title: 'আমাদের স্কোপড REST API ব্যবহার করুন অথবা টিমের সাথে কথা বলুন',
    primaryCta: 'ফ্রি ট্রায়াল শুরু করুন',
    secondaryCta: 'পার্টনারশিপ যোগাযোগ',
  },
};

export const legalBn: DeepPartial<typeof legalEn> = {
  badges: {
    draftBannerTitle: 'খসড়া (DRAFT), আইনগত পর্যালোচনার অপেক্ষায়',
    draftBannerDescription:
      'এই আইনি নথিটি প্রকাশপূর্ব খসড়া এবং প্রোডাকশন রিলিজের আগে অনুমোদিত আইনজীবী দ্বারা পর্যালোচনা ও অনুমোদন (LEGAL_APPROVED=true) প্রয়োজন।',
    approvedBannerTitle: 'আইনি পর্যালোচনা সম্পন্ন',
    versionLabel: 'সংস্করণ',
    effectiveDateLabel: 'কার্যকর তারিখ',
    reviewedOnLabel: 'পর্যালোচনার তারিখ',
    pendingReviewValue: 'পর্যালোচনার অপেক্ষায়',
  },
  nav: {
    terms: 'সেবার শর্তাবলি',
    privacy: 'গোপনীয়তা নীতি',
    cookies: 'কুকি নীতি',
    dpa: 'তথ্য প্রক্রিয়াকরণ চুক্তি (DPA)',
    subprocessors: 'সাবপ্রসেসর তালিকা',
    security: 'নিরাপত্তা ও তথ্য সংরক্ষণ',
  },
  dpa: {
    downloadCardTitle: 'স্ট্যান্ডার্ড DPA PDF ডাউনলোড করুন',
    downloadCardSubtitle: 'গ্রাহক কমপ্লায়েন্স রেকর্ডের জন্য যাচাইকৃত ফাইল স্টোরেজ ভল্ট থেকে সরাসরি পরিবেশিত।',
    downloadCta: 'DPA PDF ডাউনলোড করুন',
    subprocessorsLinkCta: 'সক্রিয় সাবপ্রসেসর দেখুন',
  },
  subprocessors: {
    eyebrow: 'অনুমোদিত তৃতীয় পক্ষের প্রসেসর',
    title: 'সাবপ্রসেসর তালিকা',
    subtitle: 'এই প্ল্যাটফর্মে সক্রিয়ভাবে ব্যবহৃত অনুমোদিত তৃতীয় পক্ষের সেবাদাতাদের তালিকা নিচে দেওয়া হলো।',
    lastUpdatedLabel: 'সর্বশেষ হালনাগাদ',
    activeCountLabel: '{{count}}টি সক্রিয় সাবপ্রসেসর',
    tableTitle: 'সক্রিয় তৃতীয় পক্ষের সাবপ্রসেসরসমূহ',
    tableHeaders: {
      provider: 'সেবাদাতা (সাবপ্রসেসর)',
      category: 'বিভাগ',
      purpose: 'তথ্য প্রক্রিয়াকরণের উদ্দেশ্য',
      dataProcessed: 'প্রক্রিয়াকৃত তথ্য',
      region: 'অঞ্চল',
    },
    unconfiguredTitle: 'যেসব বিভাগে কোনো বাহ্যিক সাবপ্রসেসর যুক্ত নেই',
    subscribeHeading: 'সাবপ্রসেসর পরিবর্তনের আপডেট পান',
    subscribeDescription: 'নতুন কোনো সাবপ্রসেসর যুক্ত বা পরিবর্তন হলে আগেই ইমেইলে বিজ্ঞপ্তি পান।',
    subscribeConsentPrefix: 'আমি CMSN-HR সাবপ্রসেসর হালনাগাদ ইমেইলে পেতে সম্মত এবং স্বীকৃতি দিচ্ছি',
  },
  consent: {
    bannerTitle: 'আপনার গোপনীয়তা ও কুকি পছন্দ',
    bannerBody:
      'আপনার মুদ্রা, ভাষা ও গোপনীয়তা পছন্দ মনে রাখতে প্রয়োজনীয় স্টোরেজ ব্যবহার করা হয়। আপনার সম্মতি ছাড়া কোনো বিশ্লেষণ বা মার্কেটিং স্ক্রিপ্ট চালানো হয় না।',
    policyLink: 'কুকি নীতি পড়ুন',
    acceptAll: 'সবগুলো গ্রহণ করুন',
    declineAll: 'অপ্রয়োজনীয়গুলো প্রত্যাখ্যান করুন',
    customize: 'কুকি সেটিংস',
    modalTitle: 'কুকি পছন্দসমূহ',
    modalSubtitle: 'CMSN-HR-এ কোন ঐচ্ছিক কুকি বিভাগ সক্রিয় থাকবে তা নির্বাচন করুন।',
    savePreferences: 'পছন্দ সংরক্ষণ করুন',
    closeModal: 'বন্ধ করুন',
    alwaysActive: 'সর্বদা সক্রিয়',
    openSettingsCta: 'কুকি পছন্দ পরিচালনা করুন',
    categories: {
      necessary: {
        title: 'অত্যাবশ্যকীয়',
        description: 'মূল নিরাপত্তা, নির্বাচিত ভাষা/মুদ্রা এবং আপনার কুকি সম্মতি সংরক্ষণের জন্য অপরিহার্য।',
      },
      analytics: {
        title: 'বিশ্লেষণ (Analytics)',
        description: 'পৃষ্ঠা পরিদর্শন ও কর্মক্ষমতা পরিমাপের ঐচ্ছিক পরিসংখ্যান—সম্মতি ছাড়া কখনোই চলে না।',
      },
      marketing: {
        title: 'মার্কেটিং',
        description: 'ক্যাম্পেইন অ্যাট্রিবিউশন পরিমাপের ঐচ্ছিক সংরক্ষণ—সম্মতি ছাড়া কখনোই চলে না।',
      },
    },
  },
};

export const companyBn: DeepPartial<typeof companyEn> = {
  about: {
    metaTitle: 'CMSN-HR সম্পর্কে | লক্ষ্য, গল্প ও মূলনীতি',
    metaDescription:
      'জানুন কেন আমরা CMSN-HR তৈরি করেছি: মাল্টি-টেন্যান্ট এইচআর, দেশভিত্তিক পেরোল নিয়ম, অফলাইন উপস্থিতি ও স্বচ্ছ নিরীক্ষা নিয়ন্ত্রণ।',
    eyebrow: 'CMSN-HR সম্পর্কে',
    title: 'বাস্তব কর্মপরিবেশের উপযোগী পেরোল ও কর্মী ব্যবস্থাপনা অবকাঠামো।',
    subtitle:
      'একাধিক শাখা, শিফট ও দেশের নিয়ম মেনে টিম পরিচালনাকারী প্রতিষ্ঠানের জন্য নির্মিত মাল্টি-টেন্যান্ট এইচআর, উপস্থিতি ও পেরোল সফটওয়্যার।',
    exploreMore: {
      title: 'প্ল্যাটফর্ম কীভাবে পরিচালিত হয় দেখুন',
      securityTitle: 'নিরাপত্তা, পৃথকীকরণ ও আস্থা',
      securityCta: 'নিরাপত্তা ও আস্থা পড়ুন',
      careersTitle: 'CMSN-HR-এ ক্যারিয়ার',
      careersCta: 'ক্যারিয়ার দেখুন',
    },
    cta: {
      heading: 'আপনার দলের জন্য CMSN-HR কীভাবে কাজ করে দেখুন',
      body: 'ফ্রি ট্রায়াল ওয়ার্কস্পেস চালু করুন অথবা আপনার দেশের পেরোল ও উপস্থিতি প্রবাহ নিয়ে আমাদের সাথে কথা বলুন।',
      primaryCta: 'ফ্রি ট্রায়াল শুরু করুন',
      secondaryCta: 'ডেমো বুক করুন',
    },
  },
  careers: {
    metaTitle: 'CMSN-HR-এ ক্যারিয়ার | বর্তমান নিয়োগ ও সংস্কৃতি',
    metaDescription:
      'CMSN-HR-এ বর্তমান শূন্যপদ ও আমাদের প্রকৌশল ও প্রোডাক্ট সংস্কৃতি সম্পর্কে জানুন।',
    eyebrow: 'ক্যারিয়ার',
    title: 'নির্ভরযোগ্য এইচআর ও পেরোল সফটওয়্যার নির্মাণে অংশ নিন।',
    openings: {
      eyebrow: 'খালি পদসমূহ',
      title: 'বর্তমান নিয়োগ বিজ্ঞপ্তি',
      applyCta: 'এই পদ সম্পর্কে জিজ্ঞাসা করুন',
      empty: {
        title: 'এই মুহূর্তে কোনো শূন্যপদ প্রকাশিত নেই',
        primaryCta: 'আমাদের টিমের সাথে যোগাযোগ করুন',
        secondaryCta: 'আমাদের প্ল্যাটফর্ম সম্পর্কে জানুন',
      },
    },
    cta: {
      heading: 'একসাথে কাজ করতে বা CMSN-HR যাচাই করতে আগ্রহী?',
      primaryCta: 'ফ্রি ট্রায়াল শুরু করুন',
      secondaryCta: 'যোগাযোগ করুন',
    },
  },
};

export const securityBn: DeepPartial<typeof securityEn> = {
  metaTitle: 'কাজের পদ্ধতি ও নিরাপত্তা এবং আস্থা',
  metaDescription:
    'জানুন কীভাবে CMSN-HR মাল্টি-টেন্যান্ট পৃথকীকরণ, AES-256-GCM এনক্রিপশন, RBAC, অপরিবর্তনীয় অডিট লগ এবং মালিক-অনুমোদিত সাপোর্ট নিশ্চিত করে।',
  eyebrow: 'নিরাপত্তা, কাঠামো ও আস্থা',
  title: 'কার্যপ্রণালি ও নিরাপত্তা নিয়ন্ত্রণসমূহ',
  subtitle:
    'CMSN-HR কীভাবে প্রতিটি টেন্যান্ট ওয়ার্কস্পেস আলাদা রাখে, সংবেদনশীল বেতন তথ্য সুরক্ষিত করে এবং সাপোর্ট প্রবেশে মালিকের সম্মতি বাধ্যতামূলক করে তার বাস্তব বিবরণ।',
  lastReviewedLabel: 'সর্বশেষ পর্যালোচনা:',
  privacyLinkLabel: 'আমাদের গোপনীয়তা নীতি পড়ুন',
  heroPrimaryCta: 'ফ্রি ট্রায়াল শুরু করুন',
  heroSecondaryCta: 'ডেমো বুক করুন',
  howItWorks: {
    eyebrow: 'কাঠামোর সারসংক্ষেপ',
    title: 'মাল্টি-টেন্যান্ট অনুরোধে তথ্য কীভাবে নিরাপদে প্রবাহিত হয়',
  },
  controlsSection: {
    eyebrow: 'কার্যকরকৃত নিরাপত্তা নিয়ন্ত্রণ',
    title: 'প্ল্যাটফর্ম জুড়ে প্রয়োগকৃত আটটি মূল নিরাপত্তা স্তর',
  },
  privacyCallout: {
    title: 'তথ্য ব্যবস্থাপনা ও গোপনীয়তা নীতি',
    cta: 'গোপনীয়তা নীতি দেখুন',
  },
};

export const customersBn: DeepPartial<typeof customersEn> = {
  index: {
    metaTitle: 'গ্রাহক ও কেস স্টাডি | CMSN-HR',
    metaDescription:
      'CMSN-HR ব্যবহার করে এইচআর, উপস্থিতি ও পেরোল পরিচালনাকারী প্রতিষ্ঠানের যাচাইকৃত অভিজ্ঞতা ও কেস স্টাডি।',
    eyebrow: 'গ্রাহক ও কেস স্টাডি',
    title: 'প্রতিষ্ঠানগুলো কীভাবে CMSN-HR-এ পেরোল ও উপস্থিতি পরিচালনা করে।',
    empty: {
      title: 'এখনো কোনো কেস স্টাডি প্রকাশিত হয়নি',
      primaryCta: 'প্ল্যাটফর্মের ফিচার দেখুন',
      secondaryCta: 'নিরাপত্তা ও আস্থা পড়ুন',
    },
  },
  cta: {
    heading: 'আপনার দলের জন্য CMSN-HR মূল্যায়ন করতে প্রস্তুত?',
    primaryCta: 'ফ্রি ট্রায়াল শুরু করুন',
    secondaryCta: 'ডেমো বুক করুন',
  },
};
