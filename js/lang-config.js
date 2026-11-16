/**
 * 15개 지원 언어, 국가 매핑, 기본 회원 등급 및 권한 구조를 단일화하여 관리하는 공통 설정 모듈
 * 프로젝트 전반(navigation, auth, admin, stats, community, my-reservations)에서 동일한 기준 데이터를 공유합니다.
 */

// 15개 지원 언어 마스터 목록 (코드, 원어명, 한국어명, 국기 이미지, 국기 이모지, 국가 표기, 통계 타일 색상)
export const LANG_LIST = [
  { code: "ko", native: "한국어", koName: "한국어", englishName: "Korean", countryLabel: "대한민국 (한국어)", selectLabel: "🇰🇷 대한민국 (한국어 / Korean)", flag: "https://flagcdn.com/w80/kr.png", emoji: "🇰🇷", color: "#ffffff", border: "rgba(255, 255, 255, 0.2)" },
  { code: "ja", native: "日本語", koName: "일본어", englishName: "Japanese", countryLabel: "일본 (日本語)", selectLabel: "🇯🇵 일본 (日本語 / Japanese)", flag: "https://flagcdn.com/w80/jp.png", emoji: "🇯🇵", color: "#38bdf8", border: "rgba(56, 189, 248, 0.2)" },
  { code: "vi", native: "Tiếng Việt", koName: "베트남어", englishName: "Vietnamese", countryLabel: "베트남 (Tiếng Việt)", selectLabel: "🇻🇳 베트남 (Tiếng Việt / Vietnamese)", flag: "https://flagcdn.com/w80/vn.png", emoji: "🇻🇳", color: "#e2e8f0", border: "rgba(226, 232, 240, 0.2)" },
  { code: "en", native: "English", koName: "영어", englishName: "English", countryLabel: "미국/기타 (English)", selectLabel: "🇺🇸 미국/기타 (English)", flag: "https://flagcdn.com/w80/gb.png", emoji: "🇺🇸", color: "#ec4899", border: "rgba(236, 72, 153, 0.2)" },
  { code: "zh", native: "中文 (简体)", koName: "중국어", englishName: "Chinese", countryLabel: "중국 (中文)", selectLabel: "🇨🇳 중국 (中文 / Chinese)", flag: "https://flagcdn.com/w80/cn.png", emoji: "🇨🇳", color: "#3b82f6", border: "rgba(59, 130, 246, 0.2)" },
  { code: "ru", native: "Русский", koName: "러시아어", englishName: "Russian", countryLabel: "러시아 (Русский)", selectLabel: "🇷🇺 러시아 (Русский / Russian)", flag: "https://flagcdn.com/w80/ru.png", emoji: "🇷🇺", color: "#f59e0b", border: "rgba(245, 158, 11, 0.2)" },
  { code: "my", native: "မြန်မာစာ", koName: "미얀마어", englishName: "Burmese", countryLabel: "미얀마 (မြန်မာစာ)", selectLabel: "🇲🇲 미얀마 (မြန်မာစာ / Myanmar)", flag: "https://flagcdn.com/w80/mm.png", emoji: "🇲🇲", color: "#a855f7", border: "rgba(168, 85, 247, 0.2)" },
  { code: "km", native: "ភាសាខ្មែរ", koName: "캄보디아어", englishName: "Khmer", countryLabel: "캄보디아 (ភាសាខ្មែរ)", selectLabel: "🇰🇭 캄보디아 (ភាសាខ្មែរ / Khmer)", flag: "https://flagcdn.com/w80/kh.png", emoji: "🇰🇭", color: "#ef4444", border: "rgba(239, 68, 68, 0.2)" },
  { code: "mn", native: "Монгол хэл", koName: "몽골어", englishName: "Mongolian", countryLabel: "몽골 (Mongolian)", selectLabel: "🇲🇳 몽골 (Mongolian)", flag: "https://flagcdn.com/w80/mn.png", emoji: "🇲🇳", color: "#10b981", border: "rgba(16, 185, 129, 0.2)" },
  { code: "th", native: "ภาษาไทย", koName: "태국어", englishName: "Thai", countryLabel: "태국 (ภาษาไทย)", selectLabel: "🇹🇭 태국 (ภาษาไทย / Thai)", flag: "https://flagcdn.com/w80/th.png", emoji: "🇹🇭", color: "#14b8a6", border: "rgba(20, 184, 166, 0.2)" },
  { code: "lo", native: "ພາສາລາວ", koName: "라오스어", englishName: "Lao", countryLabel: "라오스 (ພາສາລາວ)", selectLabel: "🇱🇦 라오스 (ພາສາລາວ / Lao)", flag: "https://flagcdn.com/w80/la.png", emoji: "🇱🇦", color: "#f43f5e", border: "rgba(244, 63, 94, 0.2)" },
  { code: "ne", native: "नेपाली", koName: "네팔어", englishName: "Nepali", countryLabel: "네팔 (नेपाली)", selectLabel: "🇳🇵 네팔 (नेपाली / Nepali)", flag: "https://flagcdn.com/w80/np.png", emoji: "🇳🇵", color: "#84cc16", border: "rgba(132, 204, 22, 0.2)" },
  { code: "id", native: "Bahasa Indonesia", koName: "인도네시아어", englishName: "Indonesian", countryLabel: "인도네시아 (Bahasa Indonesia)", selectLabel: "🇮🇩 인도네시아 (Bahasa Indonesia)", flag: "https://flagcdn.com/w80/id.png", emoji: "🇮🇩", color: "#06b6d4", border: "rgba(6, 182, 212, 0.2)" },
  { code: "si", native: "සිංහල", koName: "스리랑카어", englishName: "Sinhala", countryLabel: "스리랑카 (සිංහල)", selectLabel: "🇱🇰 스리랑카 (සිංහල / Sinhala)", flag: "https://flagcdn.com/w80/lk.png", emoji: "🇱🇰", color: "#6366f1", border: "rgba(99, 102, 241, 0.2)" },
  { code: "bn", native: "বাংলা", koName: "방글라데시어", englishName: "Bengali", countryLabel: "방글라데시 (বাংলা)", selectLabel: "🇧🇩 방글라데시 (বাংলা / Bengali)", flag: "https://flagcdn.com/w80/bd.png", emoji: "🇧🇩", color: "#d946ef", border: "rgba(217, 70, 239, 0.2)" }
];

// 상세 라벨 사전 (예: "🇰🇷 한국어 (Korean)") - 구형 코드(kh, la, np) 하위 호환 포함
export const LANG_LABELS = LANG_LIST.reduce((acc, item) => {
  acc[item.code] = `${item.emoji} ${item.koName} (${item.englishName})`;
  return acc;
}, {
  kh: "🇰🇭 캄보디아어 (Khmer)",
  la: "🇱🇦 라오스어 (Lao)",
  np: "🇳🇵 네팔어 (Nepali)"
});

// 짧은 라벨 사전 (예: "🇰🇷 한국어")
export const LANG_SHORT_LABELS = LANG_LIST.reduce((acc, item) => {
  acc[item.code] = `${item.emoji} ${item.koName}`;
  return acc;
}, {});

// 순수 한글 언어명 사전 (예: "한국어")
export const LANG_PLAIN_NAMES = LANG_LIST.reduce((acc, item) => {
  acc[item.code] = item.koName;
  return acc;
}, {});

// 국가(선호언어) 표기 사전 (회원 관리 및 문자발송 탭 공용)
export const SUPPORTED_COUNTRY_LANGS = LANG_LIST.reduce((acc, item) => {
  acc[item.code] = { flag: item.emoji, label: item.countryLabel };
  return acc;
}, {});

// 언어별 통계 타일 스타일 및 색상 설정 사전
export const LANG_STYLE_MAP = LANG_LIST.reduce((acc, item) => {
  acc[item.code] = { flag: item.emoji, label: item.koName, color: item.color, border: item.border };
  return acc;
}, {});

// 국가 식별 코드(ISO-2), 로케일 코드 및 국문/영문 국가명을 15개 공식 지원 언어 코드로 매핑하는 호환 맵
export const USER_COUNTRY_TO_LANG_MAP = {
  kr: "ko", "ko-kr": "ko", kor: "ko", korea: "ko", "한국": "ko", "대한민국": "ko", "한국어": "ko",
  jp: "ja", "ja-jp": "ja", jpn: "ja", japan: "ja", "일본": "ja", "일본어": "ja",
  vn: "vi", "vi-vn": "vi", vnm: "vi", vietnam: "vi", "베트남": "vi", "베트남어": "vi",
  us: "en", gb: "en", uk: "en", "en-us": "en", "en-gb": "en", usa: "en", english: "en", "미국": "en", "영어": "en",
  cn: "zh", "zh-cn": "zh", "zh-tw": "zh", chn: "zh", china: "zh", "중국": "zh", "중국어": "zh",
  ru: "ru", "ru-ru": "ru", rus: "ru", russia: "ru", "러시아": "ru", "러시아어": "ru",
  mm: "my", "my-mm": "my", mmr: "my", myanmar: "my", "미얀마": "my", "미얀마어": "my",
  kh: "km", "km-kh": "km", khm: "km", cambodia: "km", "캄보디아": "km", "캄보디아어": "km",
  mn: "mn", "mn-mn": "mn", mng: "mn", mongolia: "mn", "몽골": "mn", "몽골어": "mn",
  th: "th", "th-th": "th", tha: "th", thailand: "th", "태국": "th", "태국어": "th",
  la: "lo", "lo-la": "lo", lao: "lo", laos: "lo", "라오스": "lo", "라오스어": "lo",
  np: "ne", "ne-np": "ne", npl: "ne", nepal: "ne", "네팔": "ne", "네팔어": "ne",
  id: "id", "id-id": "id", idn: "id", indonesia: "id", "인도네시아": "id", "인도네시아어": "id",
  lk: "si", "si-lk": "si", lka: "si", srilanka: "si", "스리랑카": "si", "스리랑카어": "si",
  bd: "bn", "bn-bd": "bn", bgd: "bn", bangladesh: "bn", "방글라데시": "bn", "방글라데시어": "bn"
};

/**
 * 가입 회원 객체에서 국가(선호언어) 코드를 추출하여 15개 공식 지원 언어 코드로 정규화합니다.
 * @param {Object} user - 가입 회원 데이터 객체
 * @returns {string} 정규화된 2자리 언어 코드 (기본값 'ko')
 */
export function normalizeUserLangKey(user) {
  if (!user) return "ko";
  let lKey = String(user.countryLanguage || user.country || user.lang || "ko").toLowerCase().trim();

  if (USER_COUNTRY_TO_LANG_MAP[lKey]) {
    lKey = USER_COUNTRY_TO_LANG_MAP[lKey];
  } else if (lKey.includes("-") || lKey.includes("_")) {
    const basePart = lKey.split(/[-_]/)[0];
    lKey = USER_COUNTRY_TO_LANG_MAP[basePart] || basePart;
  }

  return SUPPORTED_COUNTRY_LANGS[lKey] ? lKey : "ko";
}

/**
 * 회원가입 및 프로필 수정 모달에서 사용할 15개국 선택 `<option>` HTML을 생성합니다.
 * @param {string} [selectedCode] - 기본 선택할 언어 코드
 * @returns {string} option 태그 문자열
 */
export function buildCountryLangSelectOptionsHtml(selectedCode = "") {
  return LANG_LIST.map((item) => {
    const selected = selectedCode === item.code ? " selected" : "";
    return `<option value="${item.code}"${selected}>${item.selectLabel}</option>`;
  }).join("");
}

// 기본 9대 회원 등급 및 11개 세부 권한 마스터 정의
export const DEFAULT_AVAILABLE_ROLES = [
  { key: "super_admin", label: "최고 관리자", isSystem: true, isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: true, hasPermissions: true, hasSms: true, hasStats: true, hasAds: true, hasPartners: true, hasInterpreters: true, hasCommunitySettings: true },
  { key: "admin", label: "일반 관리자", isSystem: true, isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: true, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: true },
  { key: "admin_user", label: "관리자", isSystem: false, isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: true, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: true },
  { key: "top_manager", label: "최고 매니저", isSystem: false, isAdmin: true, hasReservations: true, hasClinics: false, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: true, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: false },
  { key: "res_manager", label: "예약 매니저", isSystem: false, isAdmin: true, hasReservations: true, hasClinics: false, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: true, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: false },
  { key: "partner", label: "제휴 병원", isSystem: false, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: false, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: false },
  { key: "vip", label: "VIP 회원", isSystem: false, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: false, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: false },
  { key: "general", label: "일반", isSystem: false, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: false, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: false },
  { key: "user", label: "일반 회원", isSystem: true, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false, hasSms: false, hasStats: false, hasAds: false, hasPartners: false, hasInterpreters: false, hasCommunitySettings: false }
];

/**
 * 등급 키와 Firestore roles 문서를 바탕으로 11가지 세부 기능 권한 객체를 일관되게 생성합니다.
 * @param {string} userRole - 사용자 등급 키
 * @param {Object|null} roleData - Firestore roles/{userRole} 문서 데이터 (없으면 null)
 * @returns {Object} 정규화된 세부 권한 및 표시 라벨 객체
 */
export function buildRolePermissions(userRole, roleData = null) {
  const isSuper = userRole === "super_admin";
  const isLegacyAdmin = ["admin", "admin_user"].includes(userRole);
  const isLegacyManager = ["top_manager", "res_manager"].includes(userRole);
  const defaultRoleMeta = DEFAULT_AVAILABLE_ROLES.find((r) => r.key === userRole);
  const fallbackLabel = defaultRoleMeta ? defaultRoleMeta.label : "회원";

  if (isSuper) {
    return {
      isAdmin: true,
      hasReservations: true,
      hasClinics: true,
      hasRoles: true,
      hasPermissions: true,
      hasSms: true,
      hasStats: true,
      hasAds: true,
      hasPartners: true,
      hasInterpreters: true,
      hasCommunitySettings: true,
      label: (roleData && roleData.label) || "최고관리자"
    };
  }

  if (roleData) {
    return {
      isAdmin: roleData.isAdmin !== undefined ? !!roleData.isAdmin : (isLegacyAdmin || isLegacyManager),
      hasReservations: roleData.hasReservations !== undefined ? !!roleData.hasReservations : (isLegacyAdmin || isLegacyManager),
      hasClinics: roleData.hasClinics !== undefined ? !!roleData.hasClinics : isLegacyAdmin,
      hasRoles: roleData.hasRoles !== undefined ? !!roleData.hasRoles : false,
      hasPermissions: roleData.hasPermissions !== undefined ? !!roleData.hasPermissions : false,
      hasSms: roleData.hasSms !== undefined ? !!roleData.hasSms : false,
      hasStats: roleData.hasStats !== undefined ? !!roleData.hasStats : (isLegacyAdmin || isLegacyManager),
      hasAds: roleData.hasAds !== undefined ? !!roleData.hasAds : false,
      hasPartners: roleData.hasPartners !== undefined ? !!roleData.hasPartners : !!roleData.hasAds,
      hasInterpreters: roleData.hasInterpreters !== undefined ? !!roleData.hasInterpreters : !!roleData.hasAds,
      hasCommunitySettings: roleData.hasCommunitySettings !== undefined ? !!roleData.hasCommunitySettings : false,
      label: roleData.label || fallbackLabel
    };
  }

  // DB에 roles 문서가 없을 때의 하위 호환 폴백 매핑
  return {
    isAdmin: isLegacyAdmin || isLegacyManager,
    hasReservations: isLegacyAdmin || isLegacyManager,
    hasClinics: isLegacyAdmin,
    hasRoles: false,
    hasPermissions: false,
    hasSms: false,
    hasStats: isLegacyAdmin || isLegacyManager,
    hasAds: false,
    hasPartners: false,
    hasInterpreters: false,
    hasCommunitySettings: isLegacyAdmin,
    label: fallbackLabel
  };
}
