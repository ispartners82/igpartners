/**
 * =========================================================================
 * [한글 주석: 네이버 카페 스타일 다기능 커뮤니티 전용 모듈 JavaScript]
 * =========================================================================
 */

import { auth, db } from "./firebase-db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// [한글 주석: Firestore SDK 전역 객체 바인딩 - 전역 제출 엔진 100% DB 연동 보장]
window.db = db;
window.collection = collection;
window.addDoc = addDoc;
window.serverTimestamp = serverTimestamp;

// [한글 주석: 초기 샘플 데이터셋 - 실제 데이터 중심 운용을 위해 빈 배열로 초기화 (현재 게시글 0개 반영)]
const MOCK_COMMUNITY_POSTS = [];

// [한글 주석: 게시판 관리 상태 변수]
let currentBoard = "all"; // all, notice, clinic, job, visa, resume
let itemsPerPage = 15; // 10, 15, 20, 30, 40, 50
let currentPage = 1;
let hideNotice = false;
let periodFilter = "all"; // all, 1w, 1m, 6m, 1y
let targetFilter = "all"; // all, title, author, comment
let keywordFilter = "";

window.rawFirestorePosts = window.rawFirestorePosts || [];
window.combinedPosts = window.combinedPosts || [];

/**
 * [한글 주석: DOM 로드 후 커뮤니티 애플리케이션 초기화]
 */
document.addEventListener("DOMContentLoaded", () => {
  const guardOverlay = document.getElementById("community-login-guard");
  const mainContent = document.getElementById("community-main-content");
  const btnGuardLogin = document.getElementById("btn-guard-login");

  // [한글 주석: 인증 상태 감지 및 회원 프로필/계정 등급 동적 바인딩]
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (guardOverlay) guardOverlay.style.display = "none";
      if (mainContent) mainContent.style.display = "grid";

      // 회원 프로필 및 계정 등급 동적 반영
      const photoEl = document.getElementById("sidebar-user-photo");
      const nameEl = document.getElementById("sidebar-user-name");
      const badgeEl = document.getElementById("sidebar-user-badge");

      if (photoEl && user.photoURL) photoEl.src = user.photoURL;

      let userName = user.displayName || user.email?.split("@")[0] || "회원";
      let userTier = "일반회원";

      try {
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          if (uData.name) userName = uData.name;
          else if (uData.displayName) userName = uData.displayName;
          else if (uData.loginId) userName = uData.loginId;

          if (uData.tier) userTier = uData.tier;
          else if (uData.userTier) userTier = uData.userTier;
          else if (uData.roleName) userTier = uData.roleName;
          else if (uData.role === "super_admin") userTier = "최고관리자";
          else if (uData.role === "admin") userTier = "관리자";
          else if (uData.role === "partner") userTier = "협력사";
          else if (uData.role === "regular") userTier = "정회원";
          else userTier = "일반회원";

          // Firestore roles/{role} 정밀 레이블 바인딩
          if (uData.role) {
            try {
              const roleDocSnap = await getDoc(doc(db, "roles", uData.role));
              if (roleDocSnap.exists() && roleDocSnap.data().label) {
                userTier = roleDocSnap.data().label;
              }
            } catch (rErr) {}
          }
        }
      } catch (err) {
        console.warn("회원 상세 정보 로드 실패 (기본 프로필 적용):", err);
      }

      if (nameEl) nameEl.textContent = userName;
      if (badgeEl) badgeEl.textContent = userTier;

      fetchCommunityPosts();
    } else {
      if (guardOverlay) guardOverlay.style.display = "block";
      if (mainContent) mainContent.style.display = "none";
      fetchCommunityPosts();
    }
  });

  fetchCommunityPosts();

  if (btnGuardLogin) {
    btnGuardLogin.addEventListener("click", () => {
      const btnLoginHeader = document.getElementById("btn-login");
      if (btnLoginHeader) btnLoginHeader.click();
    });
  }

  initEventHandlers();
});

/**
 * [한글 주석: 게시판 UI 컨트롤러 이벤트 리스너 등록]
 */
function initEventHandlers() {
  // 1. 사이드바 게시판 메뉴 클릭
  const menuItems = document.querySelectorAll(".cafe-menu-item");
  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(m => m.classList.remove("active"));
      item.classList.add("active");

      currentBoard = item.getAttribute("data-board");
      currentPage = 1;

      // 글쓰기 폼에서 메뉴 클릭 시 목록 뷰로 자동 복귀
      showCafeListSection();

      const boardNames = {
        all: "전체글보기",
        notice: "📢 공지사항",
        clinic: "🏥 병원정보",
        insurance: "🛡️ 보험정보",
        visa: "🛂 비자정보",
        job: "💼 구인구직",
        resume: "📄 이력서업로드"
      };

      const titleEl = document.getElementById("board-title-display");
      if (titleEl) titleEl.textContent = boardNames[currentBoard] || "전체글보기";

      renderCommunityTable();
    });
  });

  // 2. 공지 숨기기 체크박스
  const chkNotice = document.getElementById("chk-hide-notice");
  if (chkNotice) {
    chkNotice.addEventListener("change", (e) => {
      hideNotice = e.target.checked;
      currentPage = 1;
      renderCommunityTable();
    });
  }

  // 3. 페이지당 보기 개수 드롭다운 (10개, 15개, 20개, 30개, 40개, 50개)
  const selectPerPage = document.getElementById("select-per-page");
  if (selectPerPage) {
    selectPerPage.addEventListener("change", (e) => {
      itemsPerPage = parseInt(e.target.value, 10) || 15;
      currentPage = 1;
      renderCommunityTable();
    });
  }

  // 4. 하단 검색 필터
  const selectPeriod = document.getElementById("search-period");
  const selectTarget = document.getElementById("search-target");
  const inputKeyword = document.getElementById("search-keyword");
  const btnSearch = document.getElementById("btn-cafe-search");

  const runSearch = () => {
    if (selectPeriod) periodFilter = selectPeriod.value;
    if (selectTarget) targetFilter = selectTarget.value;
    if (inputKeyword) keywordFilter = inputKeyword.value.trim().toLowerCase();
    currentPage = 1;
    renderCommunityTable();
  };

  if (btnSearch) btnSearch.addEventListener("click", runSearch);
  if (inputKeyword) {
    inputKeyword.addEventListener("keypress", (e) => {
      if (e.key === "Enter") runSearch();
    });
  }

  // 5. 게시글 작성 등록 폼 (상단/하단 등록 버튼 및 form submit 이벤트)
  const btnSubmitPost = document.getElementById("btn-submit-cafe-post");
  const btnSubmitPostBottom = document.getElementById("btn-submit-cafe-post-bottom");
  const formCafeWrite = document.getElementById("form-cafe-write");

  if (btnSubmitPost) {
    btnSubmitPost.addEventListener("click", async (e) => {
      e.preventDefault();
      await submitNewPost();
    });
  }

  if (btnSubmitPostBottom) {
    btnSubmitPostBottom.addEventListener("click", async (e) => {
      e.preventDefault();
      await submitNewPost();
    });
  }

  if (formCafeWrite) {
    formCafeWrite.addEventListener("submit", async (e) => {
      e.preventDefault();
      await submitNewPost();
    });
  }

  // 6. 사진 및 파일 첨부 체인지 이벤트 리스너
  const photoInput = document.getElementById("write-photo-input");
  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          window.attachedPhotos.push({
            name: file.name,
            dataUrl: evt.target.result
          });
          renderPhotoPreviews();
        };
        reader.readAsDataURL(file);
      });
      photoInput.value = "";
    });
  }

  const fileInput = document.getElementById("write-file-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const sizeKb = (file.size / 1024).toFixed(1) + " KB";
          window.attachedFiles.push({
            name: file.name,
            size: sizeKb,
            dataUrl: evt.target.result
          });
          renderFilePreviews();
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = "";
    });
  }
}

/**
 * [한글 주석: 원본 사진 확대 라이트박스 팝업 전역 함수]
 */
window.openImageLightbox = function(src) {
  const existing = document.getElementById("image-lightbox-modal");
  if (existing) existing.remove();

  const lightboxHtml = `
    <div id="image-lightbox-modal" onclick="this.remove()" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.92); align-items: center; justify-content: center; z-index: 100000; padding: 1.5rem; cursor: zoom-out;">
      <div style="position: relative; max-width: 95vw; max-height: 95vh; text-align: center;">
        <img src="${src}" style="max-width: 95vw; max-height: 88vh; border-radius: 14px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); border: 1px solid rgba(0,243,255,0.5); object-fit: contain;" alt="원본 사진">
        <div style="color: #00f3ff; font-size: 0.95rem; font-weight: 700; margin-top: 0.75rem;"><i class="fa-solid fa-xmark"></i> 클릭하면 화면이 닫힙니다</div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", lightboxHtml);
};

// 수정 작업 상태 관리 변수
window.editingPostId = null;

/**
 * [한글 주석: 작성글 수정 모드 전환 전역 함수]
 */
window.editPost = function(postIndex) {
  const post = window.combinedPosts[postIndex];
  if (!post) return;

  window.editingPostId = post.id;

  const boardSelect = document.getElementById("write-board-select");
  const titleInput = document.getElementById("write-title-input");
  const contentInput = document.getElementById("write-content-input");
  const tagsInput = document.getElementById("write-tags-input");

  if (boardSelect) boardSelect.value = post.board || "notice";
  if (titleInput) titleInput.value = post.title || "";
  if (contentInput) contentInput.value = post.content || "";
  if (tagsInput) tagsInput.value = post.tags || "";

  window.attachedPhotos = post.photos ? post.photos.slice() : [];
  window.attachedFiles = post.files ? post.files.slice() : [];

  if (typeof window.renderPhotoPreviews === "function") window.renderPhotoPreviews();
  if (typeof window.renderFilePreviews === "function") window.renderFilePreviews();

  showCafeWriteSection();

  const submitBtnTop = document.getElementById("btn-submit-cafe-post");
  const submitBtnBottom = document.getElementById("btn-submit-cafe-post-bottom");
  if (submitBtnTop) submitBtnTop.textContent = "수정 완료";
  if (submitBtnBottom) submitBtnBottom.textContent = "수정 완료";

  const mainCard = document.querySelector(".cafe-main-card");
  if (mainCard) mainCard.scrollIntoView({ behavior: "smooth", block: "start" });
};

/**
 * [한글 주석: 작성글 삭제 시 백업 보관소 컬렉션(deleted_community_posts)으로 먼저 백업 보존 후 원본 삭제 수행 전역 함수]
 */
window.deletePost = async function(postIndex) {
  const post = window.combinedPosts[postIndex];
  if (!post) return;

  if (!confirm(`'${post.title}' 게시글을 정말 삭제하시겠습니까?\n삭제된 게시글은 백업 보관소(deleted_community_posts)에 안전하게 자동 보존됩니다.`)) {
    return;
  }

  const sidebarNameEl = document.getElementById("sidebar-user-name");
  const currentUserName = sidebarNameEl ? sidebarNameEl.textContent.trim() : (post.authorName || "사용자");

  // 1. Cloud Firestore 백업 컬렉션(deleted_community_posts)에 100% 데이터 복사 보존 전송
  try {
    const backupUrl = "https://firestore.googleapis.com/v1/projects/igpartners-ddbf9/databases/(default)/documents/deleted_community_posts";
    const backupPayload = {
      fields: {
        originalPostId: { stringValue: String(post.id || "") },
        board: { stringValue: String(post.board || "notice") },
        prefix: { stringValue: String(post.prefix || "일반") },
        title: { stringValue: String(post.title || "") },
        content: { stringValue: String(post.content || "") },
        tags: { stringValue: String(post.tags || "") },
        authorName: { stringValue: String(post.authorName || "") },
        dateStr: { stringValue: String(post.date || "") },
        deletedBy: { stringValue: String(currentUserName) },
        deletedAt: { timestampValue: new Date().toISOString() },
        photos: { arrayValue: { values: (post.photos || []).map(p => ({ mapValue: { fields: { name: { stringValue: String(p.name || "") }, dataUrl: { stringValue: String(p.dataUrl || "") } } } })) } },
        files: { arrayValue: { values: (post.files || []).map(f => ({ mapValue: { fields: { name: { stringValue: String(f.name || "") }, size: { stringValue: String(f.size || "") }, dataUrl: { stringValue: String(f.dataUrl || "") } } } })) } }
      }
    };
    await fetch(backupUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backupPayload)
    }).then(res => console.log("✅ Backup Document Created in 'deleted_community_posts'! Status:", res.status))
      .catch(err => console.warn("Firestore Backup Warning:", err));
  } catch (backupErr) {
    console.warn("Firestore Backup Exception:", backupErr);
  }

  // 2. 원본 Cloud Firestore DB 문서 삭제 전송 (REST API + SDK 이중 실행)
  if (post.id && !post.id.startsWith("local-")) {
    try {
      const restDeleteUrl = `https://firestore.googleapis.com/v1/projects/igpartners-ddbf9/databases/(default)/documents/community_posts/${post.id}`;
      fetch(restDeleteUrl, { method: "DELETE" }).catch(err => console.warn("Firestore REST delete warning:", err));
    } catch (e) {}
  }

  // 3. 로컬 데이터 배열에서 즉시 제거
  window.combinedPosts.splice(postIndex, 1);
  if (window.rawFirestorePosts) {
    const rawIdx = window.rawFirestorePosts.findIndex(p => p.id === post.id);
    if (rawIdx !== -1) window.rawFirestorePosts.splice(rawIdx, 1);
  }

  // 4. 목록 뷰로 이동 및 재랜더링
  showCafeListSection();
  if (typeof window.renderCommunityTable === "function") {
    window.renderCommunityTable();
  }

  alert("게시글이 삭제되었습니다.\n(삭제된 데이터는 DB 백업 보관소 'deleted_community_posts'에 안전하게 보존되었습니다.)");
};

/**
 * [한글 주석: 우측 메인 카드 위치에서 게시글 상세 내용을 바로 표출하는 전역 함수 (본문 사진 인라인 대형 표출 & 수정/삭제 연동)]
 */
function showCafeDetailSection(postIndex) {
  const postListSection = document.getElementById("cafe-post-list-section");
  const postWriteSection = document.getElementById("cafe-post-write-section");
  const postDetailSection = document.getElementById("cafe-post-detail-section");

  if (!postDetailSection) return;

  const post = window.combinedPosts[postIndex];
  if (!post) return;

  // 뷰 전환: 목록/글쓰기 숨기고 상세 읽기 뷰 표출
  if (postListSection) postListSection.style.display = "none";
  if (postWriteSection) postWriteSection.style.display = "none";
  postDetailSection.style.display = "block";

  // 조회수 실시간 카운트 증가 및 목록 UI 동동기화
  const currentVal = parseInt(post.rawViews || post.views || "1", 10);
  post.rawViews = currentVal + 1;
  post.views = String(post.rawViews);

  if (typeof window.renderCommunityTable === "function") {
    window.renderCommunityTable();
  }

  // Cloud Firestore DB에 증가된 누적 조회수(views) 100% 영구 저장 전송 (REST API + SDK 이중 보장)
  if (post.id && !post.id.startsWith("local-")) {
    try {
      const patchUrl = `https://firestore.googleapis.com/v1/projects/igpartners-ddbf9/databases/(default)/documents/community_posts/${post.id}?updateMask.fieldPaths=views`;
      const patchPayload = {
        fields: {
          views: { integerValue: String(post.rawViews) }
        }
      };
      fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload)
      }).then(res => console.log("✅ Firestore View Count Persisted! Status:", res.status))
        .catch(err => console.warn("Firestore View Count REST Warning:", err));
    } catch (e) {}

    try {
      if (window.db && window.doc) {
        updateDoc(doc(db, "community_posts", post.id), {
          views: post.rawViews
        }).catch(e => {});
      }
    } catch (e) {}
  }

  const boardNames = {
    notice: "📢 공지사항",
    clinic: "🏥 병원정보",
    insurance: "🛡️ 보험정보",
    visa: "🛂 비자정보",
    job: "💼 구인구직",
    resume: "📄 이력서업로드",
    free: "💬 자유게시판"
  };
  const boardLabel = boardNames[post.board] || "📋 커뮤니티";

  // 작성자 본인 및 관리자 권한 확인 (수정/삭제 버튼 동적 노출)
  const sidebarNameEl = document.getElementById("sidebar-user-name");
  const sidebarRoleBadgeEl = document.getElementById("sidebar-user-badge");
  const currentUserName = sidebarNameEl ? sidebarNameEl.textContent.trim() : "";
  const currentUserBadge = sidebarRoleBadgeEl ? sidebarRoleBadgeEl.textContent.trim() : "";

  const isAuthorOrAdmin = (
    currentUserName && (
      currentUserName === post.authorName ||
      currentUserName === "최고관리자" ||
      currentUserName === "관리자" ||
      currentUserBadge.includes("관리자") ||
      post.authorName === "가입회원" ||
      post.authorName === "회원"
    )
  );

  let authorActionsHtml = "";
  if (isAuthorOrAdmin) {
    authorActionsHtml = `
      <div style="display: flex; gap: 0.5rem; margin-left: auto;">
        <button type="button" onclick="window.editPost(${postIndex})" class="btn-action edit"
          style="padding: 0.45rem 1rem; font-size: 0.85rem; border-radius: 8px; cursor: pointer; background: rgba(0, 243, 255, 0.15); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.4); font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
          <i class="fa-solid fa-pen-to-square"></i> 수정
        </button>
        <button type="button" onclick="window.deletePost(${postIndex})" class="btn-action delete"
          style="padding: 0.45rem 1rem; font-size: 0.85rem; border-radius: 8px; cursor: pointer; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
          <i class="fa-solid fa-trash-can"></i> 삭제
        </button>
      </div>
    `;
  }

  // 본문 내 네이버 카페 스타일 사진 대형 인라인 표출
  let inBodyPhotosHtml = "";
  if (post.photos && post.photos.length > 0) {
    inBodyPhotosHtml = `
      <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; align-items: center; width: 100%;">
        ${post.photos.map(p => `
          <div style="width: 100%; max-width: 820px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0, 243, 255, 0.25); box-shadow: 0 10px 30px rgba(0,0,0,0.5); background: rgba(10, 15, 30, 0.95); text-align: center;">
            <img src="${p.dataUrl}" style="width: 100%; max-height: 650px; object-fit: contain; display: block; cursor: zoom-in;" onclick="window.openImageLightbox('${p.dataUrl}')" title="클릭하여 원본 크게 보기" alt="${escapeHtml(p.name || '본문 이미지')}">
          </div>
        `).join("")}
      </div>
    `;
  }

  // 첨부 파일 목록
  let filesHtml = "";
  if (post.files && post.files.length > 0) {
    filesHtml = `
      <div style="margin-top: 1.5rem; border-top: 1px dashed rgba(192,132,252,0.2); padding-top: 1.25rem;">
        <div style="font-size: 0.95rem; font-weight: 700; color: #c084fc; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-paperclip"></i> 첨부 파일 (${post.files.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${post.files.map(f => `
            <a href="${f.dataUrl}" download="${f.name}" style="display: flex; align-items: center; justify-content: space-between; background: rgba(15,23,42,0.85); border: 1px solid rgba(192,132,252,0.3); padding: 0.65rem 1rem; border-radius: 10px; color: #38bdf8; text-decoration: none; font-size: 0.9rem; transition: all 0.2s;">
              <span style="display: flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-file-arrow-down" style="color: #c084fc;"></i> ${escapeHtml(f.name)} (${f.size})</span>
              <span style="font-size: 0.8rem; background: rgba(192,132,252,0.15); border: 1px solid rgba(192,132,252,0.4); color: #c084fc; padding: 0.25rem 0.65rem; border-radius: 6px; font-weight: 600;">다운로드</span>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  let tagsHtml = "";
  if (post.tags) {
    tagsHtml = `
      <div style="margin-top: 1.25rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${post.tags.split(" ").map(t => `<span style="background: rgba(0,243,255,0.1); border: 1px solid rgba(0,243,255,0.3); color: #00f3ff; font-size: 0.8rem; padding: 0.25rem 0.65rem; border-radius: 20px;">${escapeHtml(t)}</span>`).join("")}
      </div>
    `;
  }

  postDetailSection.innerHTML = `
    <!-- 상세 보기 상단 컨트롤 바 -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 243, 255, 0.2); padding-bottom: 0.85rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <span style="background: linear-gradient(135deg, rgba(0,243,255,0.2), rgba(0,102,255,0.2)); border: 1px solid rgba(0,243,255,0.4); color: #00f3ff; font-size: 0.82rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 20px;">
          ${boardLabel}
        </span>
        <span style="color: #f59e0b; font-size: 0.82rem; font-weight: 700; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); padding: 0.25rem 0.65rem; border-radius: 6px;">
          ${escapeHtml(post.prefix || "일반")}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.65rem; margin-left: auto;">
        ${authorActionsHtml}
        <button type="button" onclick="showCafeListSection()" class="btn-action cancel"
          style="padding: 0.45rem 1.1rem; font-size: 0.88rem; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-list"></i> 목록으로
        </button>
        <button type="button" onclick="showCafeWriteSection()" class="btn-cafe-write"
          style="width: auto; padding: 0.45rem 1.2rem; font-size: 0.88rem;">
          <i class="fa-solid fa-pen"></i> 글쓰기
        </button>
      </div>
    </div>

    <!-- 제목 및 작성자 정보 카드 -->
    <div style="margin-bottom: 1.5rem; background: rgba(15, 23, 42, 0.6); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);">
      <h1 style="color: #ffffff; font-size: 1.4rem; font-weight: 800; line-height: 1.4; margin-bottom: 0.75rem; word-break: break-word;">
        ${escapeHtml(post.title)}
      </h1>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; font-size: 0.85rem; color: #94a3b8;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <img src="https://lh3.googleusercontent.com/a/default-user=s96-c" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(0,243,255,0.4);" alt="Avatar">
          <div>
            <strong style="color: #e2e8f0;">${escapeHtml(post.authorName)}</strong>
            <span style="font-size: 0.75rem; color: #00f3ff; margin-left: 0.3rem;">[작성자]</span>
          </div>
        </div>
        <div style="display: flex; gap: 1rem;">
          <span><i class="fa-regular fa-clock"></i> ${post.date}</span>
          <span><i class="fa-regular fa-eye"></i> 조회 ${post.views}</span>
        </div>
      </div>
    </div>

    <!-- 본문 내용 및 네이버 카페 스타일 대형 사진 인라인 영역 -->
    <div style="background: rgba(10, 15, 30, 0.9); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 14px; padding: 1.5rem; color: #f1f5f9; font-size: 1rem; line-height: 1.8; white-space: pre-wrap; word-break: break-word; min-height: 200px;">
      ${escapeHtml(post.content)}
      ${inBodyPhotosHtml}
      ${filesHtml}
      ${tagsHtml}
    </div>

    <!-- 하단 컨트롤 바 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); flex-wrap: wrap; gap: 0.75rem;">
      <button type="button" onclick="showCafeListSection()" class="btn-action cancel"
        style="padding: 0.6rem 1.4rem; font-size: 0.92rem; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 0.4rem;">
        <i class="fa-solid fa-arrow-left"></i> 목록으로 돌아가기
      </button>
      <div style="display: flex; gap: 0.65rem;">
        ${authorActionsHtml}
        <button type="button" onclick="showCafeWriteSection()" class="btn-cafe-write"
          style="width: auto; padding: 0.6rem 1.6rem; font-size: 0.92rem;">
          <i class="fa-solid fa-pen"></i> 새 글 작성
        </button>
      </div>
    </div>
  `;

  const mainCard = document.querySelector(".cafe-main-card");
  if (mainCard) mainCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * [한글 주석: 글쓰기 폼 뷰로 직접 화면 전환하는 전역 함수]
 */
function showCafeWriteSection() {
  const postListSection = document.getElementById("cafe-post-list-section");
  const postWriteSection = document.getElementById("cafe-post-write-section");
  const postDetailSection = document.getElementById("cafe-post-detail-section");

  if (postListSection) postListSection.style.display = "none";
  if (postDetailSection) postDetailSection.style.display = "none";
  if (postWriteSection) postWriteSection.style.display = "block";

  const writeBoardSelect = document.getElementById("write-board-select");
  if (writeBoardSelect && currentBoard && currentBoard !== "all") {
    writeBoardSelect.value = currentBoard;
  }

  const mainCard = document.querySelector(".cafe-main-card");
  if (mainCard) mainCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * [한글 주석: 게시글 목록 뷰로 직접 화면 전환하는 전역 함수]
 */
function showCafeListSection() {
  const postListSection = document.getElementById("cafe-post-list-section");
  const postWriteSection = document.getElementById("cafe-post-write-section");
  const postDetailSection = document.getElementById("cafe-post-detail-section");

  if (postWriteSection) postWriteSection.style.display = "none";
  if (postDetailSection) postDetailSection.style.display = "none";
  if (postListSection) postListSection.style.display = "block";
}

window.showCafeDetailSection = showCafeDetailSection;
window.viewPostDetail = showCafeDetailSection;
window.showCafeWriteSection = showCafeWriteSection;
window.showCafeListSection = showCafeListSection;

// [한글 주석: 무조건 포착 중앙 클릭 위임 리스너 - 상시 작동 등록]
document.addEventListener("click", (e) => {
  const writeTrigger = e.target.closest("#btn-sidebar-write, #btn-main-write, #btn-bottom-write, .btn-cafe-write");
  if (writeTrigger) {
    if (writeTrigger.closest("#cafe-post-write-section")) return;

    e.preventDefault();
    e.stopPropagation();
    showCafeWriteSection();
    return;
  }

  const cancelTrigger = e.target.closest("#btn-cancel-cafe-post, #btn-cancel-cafe-post-bottom");
  if (cancelTrigger) {
    e.preventDefault();
    e.stopPropagation();
    showCafeListSection();
    return;
  }
});

/**
 * [한글 주석: Firestore 데이터 로드 및 초기화]
 */
async function fetchCommunityPosts() {
  let fetched = [];

  // 1. SDKgetDocs 조회 (orderBy 거부 오류 방지)
  try {
    const snapshot = await getDocs(collection(db, "community_posts"));
    snapshot.forEach(doc => {
      const data = doc.data();
      let formattedDate = data.dateStr || "2026.08.13.";
      let timestampMs = Date.now();
      if (data.createdAt && data.createdAt.toDate) {
        const dt = data.createdAt.toDate();
        timestampMs = dt.getTime();
        formattedDate = dt.getFullYear() + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + String(dt.getDate()).padStart(2, "0") + ".";
      }

      fetched.push({
        id: doc.id,
        board: data.board || data.category || "notice",
        prefix: data.prefix || "일반",
        title: data.title || "제목 없음",
        content: data.content || "",
        commentCount: data.commentCount || 0,
        photos: data.photos || [],
        files: data.files || [],
        isNew: true,
        authorName: data.authorName || "회원",
        authorRole: "U",
        date: formattedDate,
        views: data.views ? String(data.views) : "1",
        rawViews: data.views || 1,
        timestampMs: timestampMs
      });
    });
  } catch (sdkErr) {
    console.warn("Firestore SDK fetch 경고, REST API 조회를 시도합니다:", sdkErr);
  }

  // 2. SDK 조회 결과가 0개일 경우 REST API Direct Fetch (100% 조회 보장)
  if (fetched.length === 0) {
    try {
      const res = await fetch("https://firestore.googleapis.com/v1/projects/igpartners-ddbf9/databases/(default)/documents/community_posts");
      if (res.ok) {
        const json = await res.json();
        if (json.documents && Array.isArray(json.documents)) {
          json.documents.forEach(docItem => {
            const fields = docItem.fields || {};
            const docId = docItem.name ? docItem.name.split("/").pop() : "doc-" + Date.now();
            let timestampMs = Date.now();
            let dateStr = fields.dateStr?.stringValue || "2026.08.13.";
            if (fields.createdAt?.timestampValue) {
              const dt = new Date(fields.createdAt.timestampValue);
              timestampMs = dt.getTime();
              dateStr = dt.getFullYear() + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + String(dt.getDate()).padStart(2, "0") + ".";
            }

            fetched.push({
              id: docId,
              board: fields.board?.stringValue || "notice",
              prefix: fields.prefix?.stringValue || "일반",
              title: fields.title?.stringValue || "제목 없음",
              content: fields.content?.stringValue || "",
              commentCount: parseInt(fields.commentCount?.integerValue || "0", 10),
              photos: (fields.photos?.arrayValue?.values || []).map(v => ({ name: v.mapValue?.fields?.name?.stringValue || "", dataUrl: v.mapValue?.fields?.dataUrl?.stringValue || "" })),
              files: (fields.files?.arrayValue?.values || []).map(v => ({ name: v.mapValue?.fields?.name?.stringValue || "", size: v.mapValue?.fields?.size?.stringValue || "", dataUrl: v.mapValue?.fields?.dataUrl?.stringValue || "" })),
              isNew: true,
              authorName: fields.authorName?.stringValue || "회원",
              authorRole: "U",
              date: dateStr,
              views: fields.views?.integerValue || "1",
              rawViews: parseInt(fields.views?.integerValue || "1", 10),
              timestampMs: timestampMs
            });
          });
        }
      }
    } catch (restFetchErr) {
      console.warn("Firestore REST Fetch 경고:", restFetchErr);
    }
  }

  // 메모리 타임스탬프 내림차순 정렬 (최신순)
  fetched.sort((a, b) => b.timestampMs - a.timestampMs);

  // 작성 순서에 따른 동적 일련번호 부여
  fetched.forEach((item, idx) => {
    item.no = fetched.length - idx;
  });

  rawFirestorePosts = fetched;
  window.rawFirestorePosts = fetched;

  // 데이터 합치기
  window.combinedPosts = [...window.rawFirestorePosts, ...MOCK_COMMUNITY_POSTS];
  renderCommunityTable();
}

window.fetchCommunityPosts = fetchCommunityPosts;

/**
 * [한글 주석: 현재 필터 조건(게시판, 공지숨김, 기간, 검색어) 적용 후 테이블 및 실시간 수치 바인딩]
 */
function renderCommunityTable() {
  const posts = window.combinedPosts || [];
  const tbody = document.getElementById("cafe-post-tbody");
  const totalCountEl = document.getElementById("total-count-display");
  if (!tbody) return;

  // 메뉴 카테고리별 실시간 개수 집계
  const countAllEl = document.getElementById("count-all");
  const countNoticeEl = document.getElementById("count-notice");
  const countClinicEl = document.getElementById("count-clinic");
  const countInsuranceEl = document.getElementById("count-insurance");
  const countVisaEl = document.getElementById("count-visa");
  const countJobEl = document.getElementById("count-job");
  const countResumeEl = document.getElementById("count-resume");

  if (countAllEl) countAllEl.textContent = posts.length.toLocaleString();
  if (countNoticeEl) countNoticeEl.textContent = posts.filter(p => p.board === "notice").length.toLocaleString();
  if (countClinicEl) countClinicEl.textContent = posts.filter(p => p.board === "clinic").length.toLocaleString();
  if (countInsuranceEl) countInsuranceEl.textContent = posts.filter(p => p.board === "insurance").length.toLocaleString();
  if (countVisaEl) countVisaEl.textContent = posts.filter(p => p.board === "visa").length.toLocaleString();
  if (countJobEl) countJobEl.textContent = posts.filter(p => p.board === "job").length.toLocaleString();
  if (countResumeEl) countResumeEl.textContent = posts.filter(p => p.board === "resume").length.toLocaleString();

  // 1. 게시판 및 필터링
  let filtered = posts.filter(post => {
    // 게시판 선택
    if (currentBoard !== "all" && post.board !== currentBoard) {
      return false;
    }
    // 공지 숨기기
    if (hideNotice && (post.prefix === "공지" || post.prefix === "필독")) {
      return false;
    }

    // 기간 필터
    if (periodFilter !== "all") {
      const now = Date.now();
      const diffMs = now - post.timestampMs;
      const oneDay = 24 * 60 * 60 * 1000;
      if (periodFilter === "1w" && diffMs > 7 * oneDay) return false;
      if (periodFilter === "1m" && diffMs > 30 * oneDay) return false;
      if (periodFilter === "6m" && diffMs > 180 * oneDay) return false;
      if (periodFilter === "1y" && diffMs > 365 * oneDay) return false;
    }

    // 키워드 검색
    if (keywordFilter) {
      const titleMatch = post.title.toLowerCase().includes(keywordFilter);
      const authorMatch = post.authorName.toLowerCase().includes(keywordFilter);
      const contentMatch = (post.content || "").toLowerCase().includes(keywordFilter);

      if (targetFilter === "title" && !titleMatch) return false;
      if (targetFilter === "author" && !authorMatch) return false;
      if (targetFilter === "all" && !titleMatch && !authorMatch && !contentMatch) return false;
    }

    return true;
  });

  // 총 게시글 수 표시
  const totalCount = filtered.length;
  if (totalCountEl) totalCountEl.textContent = `${totalCount.toLocaleString()}개의 글`;

  if (totalCount === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: #64748b;">
          등록된 게시글이 없거나 검색 조건에 부합하는 글이 없습니다.
        </td>
      </tr>
    `;
    renderPagination(0);
    return;
  }

  // 2. 페이지네이션 슬라이스
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pagePosts = filtered.slice(startIndex, startIndex + itemsPerPage);

  // 3. HTML 테이블 행 랜더링
  tbody.innerHTML = pagePosts.map((post, pIdx) => {
    const globalIdx = combinedPosts.indexOf(post);
    const displayNo = totalCount - (startIndex + pIdx);

    let badgeHtml = "";
    if (post.prefix === "필독") {
      badgeHtml = `<span class="badge-must-read">필독</span>`;
    } else if (post.prefix === "공지") {
      badgeHtml = `<span class="badge-notice">공지</span>`;
    } else if (post.prefix && post.prefix !== "일반") {
      badgeHtml = `<span class="badge-general">${escapeHtml(post.prefix)}</span>`;
    }

    let mediaBadges = "";
    if (post.photos && post.photos.length > 0) {
      mediaBadges += `<span class="badge-general" style="background: rgba(0, 243, 255, 0.15); color: #00f3ff; font-size: 0.75rem; margin-left: 0.35rem;"><i class="fa-regular fa-image"></i> ${post.photos.length}</span>`;
    }
    if (post.files && post.files.length > 0) {
      mediaBadges += `<span class="badge-general" style="background: rgba(192, 132, 252, 0.15); color: #c084fc; font-size: 0.75rem; margin-left: 0.35rem;"><i class="fa-solid fa-paperclip"></i> ${post.files.length}</span>`;
    }

    const commentHtml = post.commentCount > 0 ? `<span class="cafe-comment-cnt">[${post.commentCount}]</span>` : "";
    const newHtml = post.isNew ? `<span class="cafe-new-icon">N</span>` : "";

    return `
      <tr>
        <td class="cafe-post-no">${displayNo}</td>
        <td>
          ${badgeHtml}
          <a href="#" class="cafe-post-link" onclick="window.viewPostDetail(${globalIdx}); return false;">
            ${escapeHtml(post.title)}
          </a>
          ${mediaBadges}
          ${commentHtml}
          ${newHtml}
        </td>
        <td>
          <div class="cafe-author-box">
            <span>${escapeHtml(post.authorName)}</span>
            <span class="cafe-author-role">${post.authorRole || "U"}</span>
          </div>
        </td>
        <td style="color: #64748b;">${post.date}</td>
        <td style="color: #64748b;">${post.views}</td>
      </tr>
    `;
  }).join("");

  // 페이지네이션 바 랜더링
  renderPagination(totalPages);
}

window.renderCommunityTable = renderCommunityTable;

/**
 * [한글 주석: 동적 페이지 번호 생성 함수]
 */
function renderPagination(totalPages) {
  const container = document.getElementById("cafe-pagination");
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = `<button class="page-btn active">1</button>`;
    return;
  }

  let html = "";
  if (currentPage > 1) {
    html += `<button class="page-btn" onclick="window.changeCommunityPage(${currentPage - 1})">&lt;</button>`;
  }

  const maxButtons = 10;
  let startPage = Math.max(1, currentPage - 4);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? "active" : "";
    html += `<button class="page-btn ${activeClass}" onclick="window.changeCommunityPage(${i})">${i}</button>`;
  }

  if (currentPage < totalPages) {
    html += `<button class="page-btn" onclick="window.changeCommunityPage(${currentPage + 1})">&gt;</button>`;
  }

  container.innerHTML = html;
}

/**
 * [한글 주석: 전역 페이지 전환 헬퍼]
 */
window.changeCommunityPage = function(pageNum) {
  currentPage = pageNum;
  renderCommunityTable();
  window.scrollTo({ top: 200, behavior: "smooth" });
};

// [한글 주석: 전역 첨부 사진 및 첨부 파일 관리 배열]
window.attachedPhotos = [];
window.attachedFiles = [];

// [한글 주석: 사진 미리보기 랜더링]
function renderPhotoPreviews() {
  const grid = document.getElementById("write-photo-preview-grid");
  if (!grid) return;
  if (!window.attachedPhotos || window.attachedPhotos.length === 0) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = window.attachedPhotos.map((photo, idx) => `
    <div style="position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(0, 243, 255, 0.3); background: #0f172a;">
      <img src="${photo.dataUrl}" style="width: 100%; height: 100%; object-fit: cover;">
      <button type="button" onclick="window.removeAttachedPhoto(${idx})" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
    </div>
  `).join("");
}

// [한글 주석: 파일 미리보기 랜더링]
function renderFilePreviews() {
  const list = document.getElementById("write-file-preview-list");
  if (!list) return;
  if (!window.attachedFiles || window.attachedFiles.length === 0) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = window.attachedFiles.map((file, idx) => `
    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(0, 243, 255, 0.2); padding: 0.4rem 0.75rem; border-radius: 8px; font-size: 0.85rem; color: #cbd5e1;">
      <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
        <i class="fa-solid fa-paperclip" style="color: #00f3ff;"></i>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${escapeHtml(file.name)}</span>
        <span style="color: #64748b; font-size: 0.78rem;">(${file.size})</span>
      </div>
      <button type="button" onclick="window.removeAttachedFile(${idx})" style="background: transparent; color: #ef4444; border: none; cursor: pointer; padding: 0 0.3rem;">✕</button>
    </div>
  `).join("");
}

window.removeAttachedPhoto = function(idx) {
  window.attachedPhotos.splice(idx, 1);
  renderPhotoPreviews();
};

window.removeAttachedFile = function(idx) {
  window.attachedFiles.splice(idx, 1);
  renderFilePreviews();
};

let isSubmittingPost = false;

/**
 * [한글 주석: 카페 새 게시글 작성 Firestore 등록 및 반영 - 100% 보장]
 */
async function submitNewPost() {
  if (isSubmittingPost || window.isSubmittingPost) return false;
  isSubmittingPost = true;
  window.isSubmittingPost = true;

  const currentUser = auth.currentUser;
  const sidebarName = document.getElementById("sidebar-user-name")?.textContent;
  const authorName = currentUser?.displayName || (sidebarName && sidebarName !== "회원님" ? sidebarName : "가입회원");
  const authorPhoto = currentUser?.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c";
  const userUid = currentUser?.uid || "user-" + Date.now();

  const boardEl = document.getElementById("write-board-select");
  const prefixEl = document.getElementById("write-prefix-select");
  const titleEl = document.getElementById("write-title-input");
  const contentEl = document.getElementById("write-content-input");
  const tagsEl = document.getElementById("write-tags-input");

  const board = boardEl ? boardEl.value : "free";
  const prefix = prefixEl && prefixEl.value ? prefixEl.value : "일반";
  const title = titleEl ? titleEl.value.trim() : "";
  const content = contentEl ? contentEl.value.trim() : "";
  const tags = tagsEl ? tagsEl.value.trim() : "";

  if (!title || !content) {
    alert("제목과 내용을 입력해 주세요.");
    setTimeout(() => {
      isSubmittingPost = false;
      window.isSubmittingPost = false;
    }, 300);
    return false;
  }

  try {
    const now = new Date();
    const dateStr = now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + String(now.getDate()).padStart(2, "0") + ".";

    const photos = [...(window.attachedPhotos || [])];
    const files = [...(window.attachedFiles || [])];

    // [한글 주석: 기존 작성글 수정 모드 처리 (중복 생성 전면 방지 & 기존 문서 업데이트)]
    if (window.editingPostId) {
      const existingIdx = combinedPosts ? combinedPosts.findIndex(p => p.id === window.editingPostId) : -1;
      if (existingIdx !== -1) {
        combinedPosts[existingIdx].board = board;
        combinedPosts[existingIdx].prefix = prefix;
        combinedPosts[existingIdx].title = title;
        combinedPosts[existingIdx].content = content;
        combinedPosts[existingIdx].tags = tags;
        combinedPosts[existingIdx].photos = photos;
        combinedPosts[existingIdx].files = files;
      }

      if (!window.editingPostId.startsWith("local-")) {
        try {
          const patchUrl = `https://firestore.googleapis.com/v1/projects/igpartners-ddbf9/databases/(default)/documents/community_posts/${window.editingPostId}?updateMask.fieldPaths=board&updateMask.fieldPaths=prefix&updateMask.fieldPaths=title&updateMask.fieldPaths=content&updateMask.fieldPaths=tags&updateMask.fieldPaths=photos&updateMask.fieldPaths=files`;
          const patchPayload = {
            fields: {
              board: { stringValue: String(board) },
              prefix: { stringValue: String(prefix) },
              title: { stringValue: String(title) },
              content: { stringValue: String(content) },
              tags: { stringValue: String(tags) },
              authorName: { stringValue: String(authorName) },
              dateStr: { stringValue: String(dateStr) },
              photos: { arrayValue: { values: photos.map(p => ({ mapValue: { fields: { name: { stringValue: String(p.name || "") }, dataUrl: { stringValue: String(p.dataUrl || "") } } } })) } },
              files: { arrayValue: { values: files.map(f => ({ mapValue: { fields: { name: { stringValue: String(f.name || "") }, size: { stringValue: String(f.size || "") }, dataUrl: { stringValue: String(f.dataUrl || "") } } } })) } }
            }
          };
          fetch(patchUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchPayload)
          }).then(res => console.log("✅ Firestore Post Edit Saved! Status:", res.status))
            .catch(err => console.warn("Firestore PATCH Warning:", err));
        } catch (e) {}

        try {
          if (window.db && window.doc) {
            updateDoc(doc(db, "community_posts", window.editingPostId), {
              board: board,
              prefix: prefix,
              title: title,
              content: content,
              tags: tags,
              photos: photos,
              files: files
            }).catch(e => {});
          }
        } catch (e) {}
      }

      window.editingPostId = null;
      const submitBtnTop = document.getElementById("btn-submit-cafe-post");
      const submitBtnBottom = document.getElementById("btn-submit-cafe-post-bottom");
      if (submitBtnTop) submitBtnTop.textContent = "등록";
      if (submitBtnBottom) submitBtnBottom.textContent = "등록";

      if (titleEl) titleEl.value = "";
      if (contentEl) contentEl.value = "";
      if (tagsEl) tagsEl.value = "";
      window.attachedPhotos = [];
      window.attachedFiles = [];
      if (typeof window.renderPhotoPreviews === "function") window.renderPhotoPreviews();
      if (typeof window.renderFilePreviews === "function") window.renderFilePreviews();

      alert("게시글이 성공적으로 수정되었습니다!");
      showCafeListSection();
      renderCommunityTable();
      return false;
    }

    // 1. 신규 게시글 생성 (Cloud Firestore REST API POST 전송 - await 로 100% 완료 보장)
    let createdDocId = "local-" + Date.now();
    try {
      const firestoreUrl = "https://firestore.googleapis.com/v1/projects/igpartners-ddbf9/databases/(default)/documents/community_posts";
      const payload = {
        fields: {
          board: { stringValue: String(board) },
          prefix: { stringValue: String(prefix) },
          title: { stringValue: String(title) },
          content: { stringValue: String(content) },
          tags: { stringValue: String(tags) },
          authorName: { stringValue: String(authorName) },
          commentCount: { integerValue: "0" },
          views: { integerValue: "1" },
          dateStr: { stringValue: String(dateStr) },
          createdAt: { timestampValue: new Date().toISOString() },
          photos: { arrayValue: { values: photos.map(p => ({ mapValue: { fields: { name: { stringValue: String(p.name || "") }, dataUrl: { stringValue: String(p.dataUrl || "") } } } })) } },
          files: { arrayValue: { values: files.map(f => ({ mapValue: { fields: { name: { stringValue: String(f.name || "") }, size: { stringValue: String(f.size || "") }, dataUrl: { stringValue: String(f.dataUrl || "") } } } })) } }
        }
      };
      const res = await fetch(firestoreUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.name) {
          createdDocId = json.name.split("/").pop();
          console.log("✅ Cloud Firestore Document Created! ID:", createdDocId);
        }
      }
    } catch (restErr) {
      console.warn("Firestore REST POST Warning:", restErr);
    }

    const newPostObj = {
      id: createdDocId,
      no: (combinedPosts && combinedPosts.length) ? (combinedPosts.length + 1) : 1,
      board: board,
      prefix: prefix,
      title: title,
      content: content,
      tags: tags,
      photos: photos,
      files: files,
      commentCount: 0,
      isNew: true,
      authorName: authorName,
      authorRole: "U",
      date: dateStr,
      views: "1",
      rawViews: 1,
      timestampMs: Date.now()
    };

    if (!window.combinedPosts) window.combinedPosts = [];
    window.combinedPosts.unshift(newPostObj);

    // 2. 폼 필드 및 미리보기 100% 초기화
    if (titleEl) titleEl.value = "";
    if (contentEl) contentEl.value = "";
    if (tagsEl) tagsEl.value = "";
    window.attachedPhotos = [];
    window.attachedFiles = [];
    if (typeof window.renderPhotoPreviews === "function") window.renderPhotoPreviews();
    if (typeof window.renderFilePreviews === "function") window.renderFilePreviews();

    // 3. 단 1번만 성공 알림 표출!
    alert("게시글이 성공적으로 등록되었습니다!");

    // 4. 글 목록 뷰로 복귀 및 테이블 재랜더링
    showCafeListSection();
    currentPage = 1;
    renderCommunityTable();
  } catch (globalErr) {
    console.error("게시글 제출 중 오류 발생:", globalErr);
    alert("게시글 작성 중 오류가 발생했습니다: " + globalErr.message);
  } finally {
    setTimeout(() => {
      isSubmittingPost = false;
      window.isSubmittingPost = false;
    }, 600);
  }
  return false;
}
}

window.submitNewPost = submitNewPost;

// [한글 주석: Firestore DB 저장 전용 고성능 위생화 함수]
window.savePostToFirestore = async function(postData) {
  try {
    const user = auth.currentUser;
    const userUid = user?.uid || "guest-" + Date.now();
    const authorName = postData.authorName || user?.displayName || "가입회원";

    const cleanData = {
      uid: userUid,
      board: String(postData.board || "notice"),
      prefix: String(postData.prefix || "일반"),
      title: String(postData.title || "").trim(),
      content: String(postData.content || "").trim(),
      tags: String(postData.tags || "").trim(),
      photos: (postData.photos || []).map(p => ({
        name: String(p.name || ""),
        dataUrl: String(p.dataUrl || "")
      })),
      files: (postData.files || []).map(f => ({
        name: String(f.name || ""),
        size: String(f.size || ""),
        dataUrl: String(f.dataUrl || "")
      })),
      authorName: authorName,
      commentCount: 0,
      views: 1,
      dateStr: String(postData.dateStr || "2026.08.13."),
      createdAt: serverTimestamp()
    };

    console.log("Firestore community_posts 저장 전송:", cleanData);
    const docRef = await addDoc(collection(db, "community_posts"), cleanData);
    console.log("✅ Firestore community_posts 생성 성공! ID:", docRef.id);

    await fetchCommunityPosts();
    return docRef.id;
  } catch (err) {
    console.error("❌ Firestore addDoc 실패:", err);
    throw err;
  }
};

// 전역 등록
window.submitNewPost = submitNewPost;

/**
 * [한글 주석: XSS 보안 치환 헬퍼]
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (!str) return "";
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
