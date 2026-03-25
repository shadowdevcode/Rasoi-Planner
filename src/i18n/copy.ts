import { InventoryStatus, UiLanguage } from '../types';

export interface AppCopy {
  ownerWorkspace: string;
  cookWorkspace: string;
  ownerRole: string;
  cookRole: string;
  signOut: string;
  signInPrompt: string;
  signInWithGoogle: string;
  accessRemoved: string;
  accessRemovedDetail: string;
  householdSettings: string;
  householdSettingsHelper: string;
  inviteCookHint: string;
  inviteCookPlaceholder: string;
  invite: string;
  inviting: string;
  removeCook: string;
  languageProfiles: string;
  cookAccess: string;
  ownerLanguageLabel: string;
  cookLanguageLabel: string;
  ownerLanguageHint: string;
  cookLanguageHint: string;
}

export interface OwnerCopy {
  workspaceTag: string;
  title: string;
  helper: string;
  chip: string;
  mealsTab: string;
  groceryTab: string;
  pantryTab: string;
}

export interface CookCopy {
  workspaceTag: string;
  title: string;
  helper: string;
  smartAssistant: string;
  smartAssistantHelper: string;
  aiTip: string;
  switchLabel: string;
}

export interface InventoryCopy {
  statusLabels: Record<InventoryStatus, string>;
  onGroceryList: string;
  markRestocked: string;
  addNote: string;
  noteLabel: string;
  saveNote: string;
  quantityPlaceholder: string;
  noteSaved: string;
  groceryPendingCountLabel: string;
  pantryAnomaliesCountLabel: string;
  pantryReviewItemsCountLabel: string;
  logMarkedAs: string;
}

const appCopyByLanguage: Record<UiLanguage, AppCopy> = {
  en: {
    ownerWorkspace: 'Owner workspace',
    cookWorkspace: 'Cook workspace',
    ownerRole: 'Owner',
    cookRole: 'Cook',
    signOut: 'Sign Out',
    signInPrompt: 'Sign in to sync your pantry and meal plans across all devices.',
    signInWithGoogle: 'Sign in with Google',
    accessRemoved: 'Access Removed',
    accessRemovedDetail: 'Your owner removed this cook access. Sign out and ask the owner to invite you again.',
    householdSettings: 'Household Settings',
    householdSettingsHelper: 'Manage access and language preferences without leaving the owner workspace.',
    inviteCookHint: 'Invite your cook to sync the pantry.',
    inviteCookPlaceholder: "Cook's Gmail address",
    invite: 'Invite',
    inviting: 'Inviting...',
    removeCook: 'Remove Cook',
    languageProfiles: 'Language profiles',
    cookAccess: 'Cook access',
    ownerLanguageLabel: 'Owner language profile',
    cookLanguageLabel: 'Cook language profile',
    ownerLanguageHint: 'English first with Hinglish helper is recommended for owner operations.',
    cookLanguageHint: 'Hindi first with Hinglish helper is recommended for cook operations.',
  },
  hi: {
    ownerWorkspace: 'ओनर वर्कस्पेस',
    cookWorkspace: 'कुक वर्कस्पेस',
    ownerRole: 'ओनर',
    cookRole: 'कुक',
    signOut: 'साइन आउट',
    signInPrompt: 'पेंट्री और मील प्लान सभी डिवाइस में सिंक करने के लिए साइन इन करें।',
    signInWithGoogle: 'Google से साइन इन करें',
    accessRemoved: 'एक्सेस हटाया गया',
    accessRemovedDetail: 'ओनर ने यह कुक एक्सेस हटा दिया है। साइन आउट करें और फिर से इनवाइट के लिए कहें।',
    householdSettings: 'घर की सेटिंग्स',
    householdSettingsHelper: 'ओनर वर्कस्पेस छोड़े बिना एक्सेस और भाषा पसंद संभालें।',
    inviteCookHint: 'पेंट्री सिंक के लिए अपने कुक को इनवाइट करें।',
    inviteCookPlaceholder: 'कुक का Gmail पता',
    invite: 'इनवाइट',
    inviting: 'इनवाइट भेज रहे हैं...',
    removeCook: 'कुक हटाएँ',
    languageProfiles: 'भाषा प्रोफाइल',
    cookAccess: 'कुक एक्सेस',
    ownerLanguageLabel: 'ओनर भाषा प्रोफाइल',
    cookLanguageLabel: 'कुक भाषा प्रोफाइल',
    ownerLanguageHint: 'ओनर काम के लिए English + Hinglish helper सबसे आसान रहता है।',
    cookLanguageHint: 'कुक के लिए Hindi + Hinglish helper सबसे उपयोगी रहता है।',
  },
};

const ownerCopyByLanguage: Record<UiLanguage, OwnerCopy> = {
  en: {
    workspaceTag: 'Owner workspace',
    title: 'Plan, track, and review in one place.',
    helper: 'Switch between meal planning, grocery, and pantry with clear context. Samajhne ke liye har section simple rakha gaya hai.',
    chip: 'Owner View',
    mealsTab: 'Meal Plan',
    groceryTab: 'Grocery List',
    pantryTab: 'Pantry & Logs',
  },
  hi: {
    workspaceTag: 'ओनर वर्कस्पेस',
    title: 'योजना, ट्रैकिंग और समीक्षा एक ही जगह।',
    helper: 'मील प्लान, किराना और पेंट्री एक ही जगह से संभालें। हर सेक्शन का मतलब आसान रखा गया है।',
    chip: 'ओनर व्यू',
    mealsTab: 'मील प्लान',
    groceryTab: 'किराना सूची',
    pantryTab: 'पेंट्री और लॉग्स',
  },
};

const cookCopyByLanguage: Record<UiLanguage, CookCopy> = {
  en: {
    workspaceTag: 'Cook workspace',
    title: "Today's Menu & Pantry Status",
    helper: 'Menu, pantry check, and quick updates in one place. Jaldi samajh ke kaam karne ke liye text simple hai.',
    smartAssistant: 'Smart Assistant',
    smartAssistantHelper: 'Quick status updates and unlisted item requests. Jo item list me nahi hai, woh bhi add kar sakte ho.',
    aiTip: 'Tip: Type something like "Tamatar aur atta khatam ho gaya hai".',
    switchLabel: 'Switch Language',
  },
  hi: {
    workspaceTag: 'कुक वर्कस्पेस',
    title: 'आज का मेनू और पेंट्री स्थिति',
    helper: 'मेनू, पेंट्री चेक और त्वरित अपडेट एक ही जगह। जल्दी समझने के लिए Hinglish मदद भी दी गई है।',
    smartAssistant: 'स्मार्ट असिस्टेंट',
    smartAssistantHelper: 'त्वरित स्टेटस अपडेट और अनलिस्टेड आइटम रिक्वेस्ट। जो सामान लिस्ट में नहीं है, वह भी जोड़ सकते हैं।',
    aiTip: 'टिप: ऐसे लिखें "Tamatar aur atta khatam ho gaya hai".',
    switchLabel: 'भाषा बदलें',
  },
};

const inventoryCopyByLanguage: Record<UiLanguage, InventoryCopy> = {
  en: {
    statusLabels: {
      'in-stock': 'In Stock',
      low: 'Running Low',
      out: 'Out of Stock',
    },
    onGroceryList: 'On List',
    markRestocked: 'Mark Restocked',
    addNote: 'Add Note',
    noteLabel: 'Note',
    saveNote: 'Save note',
    quantityPlaceholder: 'Quantity? (e.g. 2kg)',
    noteSaved: 'Note saved',
    groceryPendingCountLabel: 'pending grocery items',
    pantryAnomaliesCountLabel: 'pantry anomalies',
    pantryReviewItemsCountLabel: 'pantry review items',
    logMarkedAs: 'marked',
  },
  hi: {
    statusLabels: {
      'in-stock': 'स्टॉक में है',
      low: 'कम हो रहा है',
      out: 'खत्म हो गया',
    },
    onGroceryList: 'सूची में है',
    markRestocked: 'फिर से भर गया',
    addNote: 'नोट जोड़ें',
    noteLabel: 'नोट',
    saveNote: 'नोट सेव करें',
    quantityPlaceholder: 'कितना चाहिए? (उदा: 2kg)',
    noteSaved: 'नोट सेव हो गया',
    groceryPendingCountLabel: 'किराना आइटम लंबित',
    pantryAnomaliesCountLabel: 'पेंट्री विसंगतियां',
    pantryReviewItemsCountLabel: 'पेंट्री समीक्षा आइटम',
    logMarkedAs: 'मार्क किया',
  },
};

export function getAppCopy(language: UiLanguage): AppCopy {
  return appCopyByLanguage[language];
}

export function getOwnerCopy(language: UiLanguage): OwnerCopy {
  return ownerCopyByLanguage[language];
}

export function getCookCopy(language: UiLanguage): CookCopy {
  return cookCopyByLanguage[language];
}

export function getInventoryCopy(language: UiLanguage): InventoryCopy {
  return inventoryCopyByLanguage[language];
}
