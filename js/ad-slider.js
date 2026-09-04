/**
 * IGPartners - 홈페이지 실시간 동적 광고 배너 렌더러 및 슬라이더 연동 엔진
 * Firestore 'ads' 컬렉션의 데이터를 실시간 조회하여 화면에 동적으로 렌더링하고,
 * 각 광고별로 지정된 고유 슬라이드 간격(slideInterval)에 맞춰 사진을 자동으로 개별 롤링합니다.
 * DB가 비어있는 경우 사이트 정돈감을 위해 8개의 고화질 웰니스 샘플 광고를 자동 백업(Fallback) 노출합니다.
 */

import { db } from "/js/firebase-db.js?v=260904_1";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// [한글 주석: 통합 광고 배너 로컬 캐시 키 정의 (SWR 캐시 엔진용)]
const CACHE_KEY = "cached_home_ads_data";

// DB가 비어있을 때 대신 렌더링되는 백업 샘플 광고 데이터 8개 정의
const FALLBACK_ADS = [
  {
    tag: "이심당치과",
    title: "스마트 디지털 임플란트",
    desc: "정밀 3D 스캔 진단을 기반으로 한 아프지 않은 치아 복원 및 보철 치료",
    slideInterval: 3500,
    images: [
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&q=80",
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&q=80"
    ]
  },
  {
    tag: "BL성형피부과",
    title: "나이 맞춤 안티에이징",
    desc: "글로벌 프리미엄 레이저 리프팅 기기 및 쁘띠 필러 맞춤형 시술 프로그램",
    slideInterval: 4200,
    images: [
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80",
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80"
    ]
  },
  {
    tag: "새론안과 의원",
    title: "통증 최소화 노안 라섹",
    desc: "검증된 50여 가지 사전 안구 안전 검사를 통한 맞춤형 레이저 시력교정",
    slideInterval: 3800,
    images: [
      "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?w=400&q=80",
      "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&q=80"
    ]
  },
  {
    tag: "우리들병원",
    title: "비수술 도수 통증관리",
    desc: "전담 물리치료사와 첨단 통증 치료 장비를 통한 척추, 관절 1:1 맞춤 케어",
    slideInterval: 4500,
    images: [
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80",
      "https://images.unsplash.com/photo-1597764690523-15bea4c581c9?w=400&q=80"
    ]
  },
  {
    tag: "꽃담한방병원",
    title: "전통 침술 및 한약 처방",
    desc: "기혈 흐름을 회복하는 침구 치료와 체질 맞춤 유기농 한방 보충 약재 조제",
    slideInterval: 3300,
    images: [
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=400&q=80",
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80"
    ]
  },
  {
    tag: "세강병원 내과",
    title: "위/대장 수면 내시경",
    desc: "대학병원급 정밀 내시경 카메라를 활용한 안전하고 편안한 원스톱 건강검진",
    slideInterval: 4000,
    images: [
      "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&q=80",
      "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=400&q=80"
    ]
  },
  {
    tag: "더필병원 재활과",
    title: "도수 및 운동 운동치료",
    desc: "수술 후 기능 복원을 돕는 운동 과학 시스템 연계 개인 맞춤 트레이닝",
    slideInterval: 3600,
    images: [
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400&q=80",
      "https://images.unsplash.com/photo-1616391182219-e080b4d1043a?w=400&q=80"
    ]
  },
  {
    tag: "IGPartners",
    title: "1:1 전담 전문 의료 통역",
    desc: "언어 장벽 없는 안심 진료를 위해 다국어 전문 의료 코디네이터가 병원에 동행합니다",
    slideInterval: 4100,
    images: [
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&q=80",
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=80"
    ]
  }
];

// [한글 주석: 활성화된 슬라이더 인터벌 타이머 ID들을 추적 관리하여 화면 재렌더링 시 중복 실행 방지]
let activeSliderIntervals = [];

/**
 * [한글 주석: 광고 배너 배열을 받아 HTML DOM을 생성하고 슬라이더를 구동하는 렌더링 전용 함수]
 * @param {Array} list - 표시할 광고 데이터 배열
 */
function renderAds(list) {
  const adGridContainer = document.getElementById("ad-grid-container");
  if (!adGridContainer) return;

  // 1. 기존 동작 중인 슬라이더 인터벌 타이머를 모두 정리(Clear)
  activeSliderIntervals.forEach(timerId => clearInterval(timerId));
  activeSliderIntervals = [];

  // 2. 표시할 데이터가 비어있을 경우 기본 백업 샘플 광고 적용
  const displayList = (list && list.length > 0) ? list : FALLBACK_ADS;

  // 3. 광고 그리드 컨테이너 비우기 및 카드 요소 동적 생성 주입
  adGridContainer.innerHTML = "";

  displayList.forEach((ad, index) => {
    const card = document.createElement("div");
    card.className = "ad-card";
    card.setAttribute("data-ad-index", index);

    // 슬라이드에 노출될 이미지들의 HTML 조각 생성 (첫 번째 이미지만 active 클래스 부여)
    let slidesHtml = "";
    if (ad.images && ad.images.length > 0) {
      ad.images.forEach((imgUrl, i) => {
        slidesHtml += `
          <img class="ad-slide ${i === 0 ? 'active' : ''}" src="${imgUrl}" alt="${ad.tag || '광고'} 슬라이드 이미지 ${i + 1}">
        `;
      });
    }

    card.innerHTML = `
      <div class="ad-slide-wrapper">
        ${slidesHtml}
      </div>
      <div class="ad-info">
        <span class="ad-tag">${ad.tag || ""}</span>
        <h3 class="ad-title">${ad.title || ""}</h3>
        <p class="ad-desc">${ad.desc || ""}</p>
      </div>
    `;

    adGridContainer.appendChild(card);

    // 4. 개별 광고 카드 내 지정된 slideInterval(ms)에 맞춰 자동 슬라이더 구동
    const slides = card.querySelectorAll(".ad-slide");
    if (slides.length > 1) {
      let currentSlideIdx = 0;
      const nextSlide = () => {
        slides[currentSlideIdx].classList.remove("active");
        currentSlideIdx = (currentSlideIdx + 1) % slides.length;
        slides[currentSlideIdx].classList.add("active");
      };

      const intervalMs = ad.slideInterval || 4000;
      const timerId = setInterval(nextSlide, intervalMs);
      activeSliderIntervals.push(timerId);
    }
  });
}

/**
 * [한글 주석: SWR(Stale-While-Revalidate) 전략으로 0.01초 즉시 렌더링 후 최신 데이터 비동기 동기화]
 */
async function initPage() {
  const adGridContainer = document.getElementById("ad-grid-container");
  if (!adGridContainer) return;

  // [한글 주석: 구형 버전의 LocalStorage 캐시 키 정리]
  try {
    localStorage.removeItem("cached_home_ads");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("cached_home_ads_v")) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn("Storage cleanup notice:", e);
  }

  // ── [1단계: Stale] 로컬 캐시가 있으면 0.01초 만에 즉시 렌더링 ──
  let cachedData = null;
  try {
    const rawCache = localStorage.getItem(CACHE_KEY);
    if (rawCache) {
      cachedData = JSON.parse(rawCache);
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        renderAds(cachedData);
        console.log("⚡ [SWR] Home ads rendered immediately from Local Cache.");
      }
    }
  } catch (e) {
    console.warn("Local cache parse error:", e);
  }

  // 로컬 캐시가 없으면 기본 백업 샘플 광고로 우선 즉시 렌더링
  if (!cachedData) {
    renderAds(FALLBACK_ADS);
  }

  // ── [2단계: Revalidate] 백그라운드에서 Firestore 최신 데이터 비동기 조회 ──
  try {
    const q = query(collection(db, "ads"), orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);

    const freshAds = [];
    if (!querySnapshot.empty) {
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        freshAds.push({
          id: docSnap.id,
          tag: d.tag || "",
          title: d.title || "",
          desc: d.desc || "",
          slideInterval: d.slideInterval || 4000,
          images: d.images || [],
          order: typeof d.order === "number" ? d.order : 0
        });
      });
    }

    // ── [3단계: Update] 데이터 비교 후 변경 사항이 있으면 최신 데이터로 화면 갱신 ──
    const freshDataStr = JSON.stringify(freshAds);
    const cachedDataStr = JSON.stringify(cachedData || []);

    if (freshDataStr !== cachedDataStr) {
      console.log("🔄 [SWR] Fresh ads detected from Firestore. Updating UI and Cache.");
      renderAds(freshAds);
      localStorage.setItem(CACHE_KEY, freshDataStr);
    } else {
      console.log("✅ [SWR] Local Cache is already up-to-date with Firestore.");
      localStorage.setItem(CACHE_KEY, freshDataStr);
    }
  } catch (error) {
    console.error("❌ [SWR] Firestore ads background fetch error:", error);
  }
}

// [한글 주석: 최초 하드 로딩 시점에는 DOMContentLoaded를 대기하고, SPA 뷰 전환 시점에는 즉시 실행되도록 readyState 감지 분기 처리]
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
