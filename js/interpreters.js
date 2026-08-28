/**
 * [한글 주석] 전문 의료 통역 서비스 클라이언트 스크립트 (interpreters.js)
 * - Firebase Firestore DB 'interpreters' 컬렉션 실시간/비동기 연동
 * - 'IGPartners 소속 통역' 및 '프리랜서 통역사' 카드 동적 렌더링
 * - 초기 데이터 부재 시 자동 시딩(Seed) 기능 내장
 */

import { db } from "/js/firebase-db.js?v=2.0.7";
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// [한글 주석: 초기 시연용 기본 통역사 Seed 데이터셋]
const seedInterpreters = [
  // 1. IGPartners 소속 통역사 (사진 포함, 명함 카드 레이아웃)
  {
    type: "staff",
    name: "박지안 (Park Ji-an)",
    country: "한국 (Korea)",
    countryCode: "kr",
    flag: "https://flagcdn.com/w80/kr.png",
    phone: "010-5021-8278",
    email: "jian.park@igpartners.com",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
    order: 1,
    createdAt: new Date().toISOString()
  },
  {
    type: "staff",
    name: "Nguyễn Thị Mai (응우옌 티 마이)",
    country: "베트남 (Vietnam)",
    countryCode: "vn",
    flag: "https://flagcdn.com/w80/vn.png",
    phone: "010-4297-8528",
    email: "mai.nguyen@igpartners.com",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80",
    order: 2,
    createdAt: new Date().toISOString()
  },
  {
    type: "staff",
    name: "Elena Ivanova (엘레나 이바노바)",
    country: "러시아 (Russia)",
    countryCode: "ru",
    flag: "https://flagcdn.com/w80/ru.png",
    phone: "010-8378-8683",
    email: "elena.i@igpartners.com",
    image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&auto=format&fit=crop&q=80",
    order: 3,
    createdAt: new Date().toISOString()
  },
  {
    type: "staff",
    name: "Wang Lei (왕 레이)",
    country: "중국 (China)",
    countryCode: "cn",
    flag: "https://flagcdn.com/w80/cn.png",
    phone: "010-7369-4589",
    email: "lei.wang@igpartners.com",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    order: 4,
    createdAt: new Date().toISOString()
  },

  // 2. 프리랜서 통역사 (사진 미포함, 국기 + 국가명/이름/연락처 카드 레이아웃)
  {
    type: "freelance",
    name: "Tran Van Giap (쩐 반 지압)",
    country: "베트남",
    countryCode: "vn",
    flag: "https://flagcdn.com/w80/vn.png",
    phone: "010-8449-3394",
    email: "giap.tran@gmail.com",
    order: 5,
    createdAt: new Date().toISOString()
  },
  {
    type: "freelance",
    name: "Nway Nway Kyaw (느웨이 느웨이)",
    country: "미얀마",
    countryCode: "mm",
    flag: "https://flagcdn.com/w80/mm.png",
    phone: "010-6516-1410",
    email: "nway.kyaw@gmail.com",
    order: 6,
    createdAt: new Date().toISOString()
  },
  {
    type: "freelance",
    name: "Batbold Erdene (바트볼드 에르데네)",
    country: "몽골",
    countryCode: "mn",
    flag: "https://flagcdn.com/w80/mn.png",
    phone: "010-8208-0734",
    email: "batbold.e@gmail.com",
    order: 7,
    createdAt: new Date().toISOString()
  },
  {
    type: "freelance",
    name: "Somchai Prasert (솜차이 프라서트)",
    country: "태국",
    countryCode: "th",
    flag: "https://flagcdn.com/w80/th.png",
    phone: "010-5889-2103",
    email: "somchai.p@gmail.com",
    order: 8,
    createdAt: new Date().toISOString()
  },
  {
    type: "freelance",
    name: "Chan Vanna (찬 반나)",
    country: "캄보디아",
    countryCode: "kh",
    flag: "https://flagcdn.com/w80/kh.png",
    phone: "010-8193-8868",
    email: "vanna.chan@gmail.com",
    order: 9,
    createdAt: new Date().toISOString()
  },
  {
    type: "freelance",
    name: "Sithong Keomany (시통 케오마니)",
    country: "라오스",
    countryCode: "la",
    flag: "https://flagcdn.com/w80/la.png",
    phone: "010-8861-1072",
    email: "sithong.k@gmail.com",
    order: 10,
    createdAt: new Date().toISOString()
  }
];

/**
 * [한글 주석] 통역사 목록 로드 및 화면 렌더링 메인 함수
 */
async function loadInterpreters() {
  const staffContainer = document.getElementById("staff-interpreters-grid");
  const freelanceContainer = document.getElementById("freelance-interpreters-grid");

  if (!staffContainer || !freelanceContainer) return;

  try {
    const q = query(collection(db, "interpreters"), orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);

    // [한글 주석] 데이터가 없을 경우 기본 Seed 데이터 자동 생성 및 재로드
    if (querySnapshot.empty) {
      console.log("No interpreters found. Populating default seed data...");
      for (const item of seedInterpreters) {
        await addDoc(collection(db, "interpreters"), item);
      }
      return loadInterpreters();
    }

    const staffList = [];
    const freelanceList = [];

    querySnapshot.forEach((docSnap) => {
      const data = { ...docSnap.data(), id: docSnap.id };
      if (data.type === "staff") {
        staffList.push(data);
      } else {
        freelanceList.push(data);
      }
    });

    // 1. [소속 통역사] 카드 렌더링 (명함 카드: 좌측 사진 + 우측 상단 국기/국가명 + 우측 하단 이름)
    renderStaffInterpreters(staffList, staffContainer);

    // 2. [프리랜서 통역사] 카드 렌더링 (좌측 국기 + 우측 국가명/이름/연락처)
    renderFreelanceInterpreters(freelanceList, freelanceContainer);

  } catch (error) {
    console.error("Failed to load interpreters:", error);
    staffContainer.innerHTML = `<div class="interpreters-empty">통역사 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`;
    freelanceContainer.innerHTML = `<div class="interpreters-empty">통역사 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`;
  }
}

/**
 * [한글 주석] IGPartners 소속 통역사 명함 카드 목록 렌더링
 * @param {Array} list - 소속 통역사 목록 데이터
 * @param {HTMLElement} container - 렌더링 대상 컨테이너
 */
function renderStaffInterpreters(list, container) {
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<div class="interpreters-empty">등록된 소속 통역사가 없습니다.</div>`;
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "staff-card";

    // 기본 대체 이미지 처리
    const photoUrl = item.image || "/img/default_avatar.png";
    const flagUrl = item.flag || `https://flagcdn.com/w80/${item.countryCode || 'kr'}.png`;

    card.innerHTML = `
      <!-- 좌측: 통역사 사진 영역 -->
      <div class="staff-card-left">
        <div class="staff-photo-wrapper">
          <img src="${photoUrl}" alt="${item.name}" class="staff-photo" loading="lazy" onerror="this.src='/img/logo.png'">
        </div>
      </div>

      <!-- 우측: 국기, 국가명, 이름, 소속 정보 영역 -->
      <div class="staff-card-right">
        <div class="staff-country-badge">
          <img src="${flagUrl}" alt="${item.country}" class="staff-flag-icon" onerror="this.style.display='none'">
          <span class="staff-country-name">${item.country}</span>
        </div>
        <div class="staff-name-box">
          <h3 class="staff-name">${item.name}</h3>
          <span class="staff-role-badge">IGPartners 전담</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * [한글 주석] 프리랜서 통역사 카드 목록 렌더링
 * @param {Array} list - 프리랜서 통역사 목록 데이터
 * @param {HTMLElement} container - 렌더링 대상 컨테이너
 */
function renderFreelanceInterpreters(list, container) {
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<div class="interpreters-empty">등록된 프리랜서 통역사가 없습니다.</div>`;
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "freelance-card";

    const flagUrl = item.flag || `https://flagcdn.com/w80/${item.countryCode || 'kr'}.png`;
    const phoneFormatted = item.phone || "-";
    const phoneTel = item.phone ? item.phone.replace(/[^0-9+]/g, "") : "";

    card.innerHTML = `
      <!-- 좌측: 국기 뱃지 영역 -->
      <div class="freelance-card-left">
        <div class="freelance-flag-box">
          <img src="${flagUrl}" alt="${item.country}" class="freelance-flag-img" onerror="this.style.display='none'">
        </div>
      </div>

      <!-- 우측: 국가명, 이름, 연락처 영역 -->
      <div class="freelance-card-right">
        <div class="freelance-country-tag">${item.country}</div>
        <h4 class="freelance-name">${item.name}</h4>
        <div class="freelance-contact-row">
          ${phoneTel ? `<a href="tel:${phoneTel}" class="freelance-phone-link" title="전화걸기">📞 <span>${phoneFormatted}</span></a>` : `<span class="freelance-phone-empty">연락처 미등록</span>`}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// [한글 주석] DOM 로드 완료 시 즉시 통역사 목록 로드 실행 (SPA 뷰 또는 정적 로드 모두 안전 대응)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadInterpreters();
  });
} else {
  loadInterpreters();
}
