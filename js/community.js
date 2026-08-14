/**
 * =========================================================================
 * [한글 주석: IGPartners 커뮤니티 전용 마스터 JavaScript 모듈 - Full Clean Rebuild]
 * [한글 주석: 이중/삼중 호출과 얽힌 비동기 구문을 전면 제거하고 단일 동기화 구조로 깨끗하게 새로 작성]
 * =========================================================================
 */

import { auth, db } from "./firebase-db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// [한글 주석: Firestore SDK 전역 객체 바인딩]
window.db = db;
window.collection = collection;
window.addDoc = addDoc;
window.doc = doc;
window.getDoc = getDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.serverTimestamp = serverTimestamp;

// [한글 주석: 전역 상태 변수 정돈]
let currentBoard = "all";
let itemsPerPage = 15;
let currentPage = 1;
let hideNotice = false;
let periodFilter = "all";
let targetFilter = "all";
let keywordFilter = "";

window.rawFirestorePosts = [];
window.combinedPosts = [];
window.editingPostId = null;
window.attachedPhotos = [];
window.attachedFiles = [];
window.currentUserUid = "";
window.currentUserRole = "";

let savedEditorRange = null;

/**
 * [한글 주석: 에디터 커서 위치 기억 유틸리티]
 */
function saveEditorSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    savedEditorRange = sel.getRangeAt(0);
  }
}

/**
 * [한글 주석: 네이버 카페 스마트 에디터 스타일 - 커서 위치에 대형 사진 즉시 자동 삽입 모듈]
 */
function insertImageAtCursor(imgDataUrl, fileName) {
  const editor = document.getElementById("write-content-editor");
  if (!editor) return;

  editor.focus();

  const imgWrap = document.createElement("div");
  imgWrap.className = "editor-inline-image-wrap";
  imgWrap.contentEditable = "false";
  imgWrap.style.margin = "1.25rem 0";
  imgWrap.style.textAlign = "center";
  imgWrap.style.userSelect = "none";
  imgWrap.innerHTML = `
    <div style="position: relative; display: inline-block; max-width: 100%; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0, 243, 255, 0.4); box-shadow: 0 10px 30px rgba(0,0,0,0.5); background: rgba(10, 15, 30, 0.95);">
      <img src="${imgDataUrl}" style="max-width: 100%; max-height: 600px; object-fit: contain; display: block;" alt="${escapeHtml(fileName)}">
      <button type="button" onclick="this.closest('.editor-inline-image-wrap').remove()" title="사진 삭제" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.9); color: #ffffff; border: none; border-radius: 50%; width: 26px; height: 26px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">✕</button>
    </div>
  `;

  const blankPara = document.createElement("p");
  blankPara.innerHTML = "<br>";

  const sel = window.getSelection();
  if (savedEditorRange && editor.contains(savedEditorRange.commonAncestorContainer)) {
    sel.removeAllRanges();
    sel.addRange(savedEditorRange);

    savedEditorRange.deleteContents();
    savedEditorRange.insertNode(blankPara);
    savedEditorRange.insertNode(imgWrap);

    const newRange = document.createRange();
    newRange.setStartAfter(blankPara);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } else {
    editor.appendChild(imgWrap);
    editor.appendChild(blankPara);
  }

  savedEditorRange = null;
}

window.insertImageAtCursor = insertImageAtCursor;

/**
 * [한글 주석: DOM 로드 완료 후 커뮤니티 메인 초기화 엔진]
 */
document.addEventListener("DOMContentLoaded", () => {
  const guardOverlay = document.getElementById("community-login-guard");
  const mainContent = document.getElementById("community-main-content");
  const btnGuardLogin = document.getElementById("btn-guard-login");

  // 1. 페이지 로드 즉시 다이렉트로 단 한 번 게시글 3개 최우선 1순위 로드
  fetchCommunityPosts();

  // 2. Auth 로그인 세션 수신 - 오직 프로필 사이드바 텍스트만 업데이트 (중복 쿼리 제거)
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (guardOverlay) guardOverlay.style.display = "none";
      if (mainContent) mainContent.style.display = "grid";

      window.currentUserUid = user.uid;
      window.currentUserRole = "user";

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
          if (uData.role) window.currentUserRole = uData.role;

          if (uData.name) userName = uData.name;
          else if (uData.displayName) userName = uData.displayName;

          if (uData.tier) userTier = uData.tier;
          else if (uData.role === "super_admin") userTier = "최고관리자";
          else if (uData.role === "admin") userTier = "관리자";
          else if (uData.role === "partner") userTier = "협력사";
        }
      } catch (e) {}

      if (nameEl) nameEl.textContent = userName;
      if (badgeEl) badgeEl.textContent = userTier;
    } else {
      if (guardOverlay) guardOverlay.style.display = "block";
      if (mainContent) mainContent.style.display = "none";
    }
  });

  if (btnGuardLogin) {
    btnGuardLogin.addEventListener("click", () => {
      const btnLoginHeader = document.getElementById("btn-login");
      if (btnLoginHeader) btnLoginHeader.click();
    });
  }

  // 3. UI 컨트롤러 이벤트 등록
  initEventHandlers();
});

/**
 * [한글 주석: Firestore 게시글 3개 단일 동기화 로드 함수]
 */
async function fetchCommunityPosts() {
  let fetched = [];

  try {
    const snapshot = await getDocs(collection(db, "community_posts"));
    snapshot.forEach(docSnap => {
      try {
        const data = docSnap.data();
        let formattedDate = data.dateStr || "2026.08.13.";
        let timestampMs = Date.now();

        if (data.createdAt) {
          if (typeof data.createdAt.toDate === "function") {
            const dt = data.createdAt.toDate();
            timestampMs = dt.getTime();
            formattedDate = dt.getFullYear() + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + String(dt.getDate()).padStart(2, "0") + ".";
          } else if (typeof data.createdAt === "object" && data.createdAt !== null && data.createdAt.seconds) {
            const dt = new Date(data.createdAt.seconds * 1000);
            timestampMs = dt.getTime();
            formattedDate = dt.getFullYear() + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + String(dt.getDate()).padStart(2, "0") + ".";
          } else if (typeof data.createdAt === "string") {
            const dt = new Date(data.createdAt);
            if (!isNaN(dt.getTime())) {
              timestampMs = dt.getTime();
              formattedDate = dt.getFullYear() + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + String(dt.getDate()).padStart(2, "0") + ".";
            }
          }
        }

        let safePhotos = [];
        if (Array.isArray(data.photos)) {
          safePhotos = data.photos.map(p => ({
            name: typeof p === "object" && p !== null ? (p.name || "") : "",
            dataUrl: typeof p === "object" && p !== null ? (p.dataUrl || "") : ""
          }));
        }

        let safeFiles = [];
        if (Array.isArray(data.files)) {
          safeFiles = data.files.map(f => ({
            name: typeof f === "object" && f !== null ? (f.name || "") : "",
            size: typeof f === "object" && f !== null ? (f.size || "") : "",
            dataUrl: typeof f === "object" && f !== null ? (f.dataUrl || "") : ""
          }));
        }

        const targetBoard = data.board || data.category || "notice";
        const isSecretPost = data.isSecret || targetBoard === "resume";

        fetched.push({
          id: docSnap.id,
          board: targetBoard,
          prefix: data.prefix || "일반",
          title: data.title || "제목 없음",
          content: data.content || "",
          contentHtml: data.contentHtml || "",
          authorUid: data.authorUid || "",
          isSecret: isSecretPost,
          commentCount: typeof data.commentCount === "number" ? data.commentCount : parseInt(data.commentCount || "0", 10),
          photos: safePhotos,
          files: safeFiles,
          isNew: true,
          authorName: data.authorName || "회원",
          authorRole: "U",
          date: formattedDate,
          views: data.views ? String(data.views) : "1",
          rawViews: parseInt(data.views || "1", 10),
          timestampMs: timestampMs
        });
      } catch (e) {}
    });
  } catch (err) {
    console.error("Firestore 로드 예외:", err);
  }

  // 타임스탬프 내림차순 정렬
  fetched.sort((a, b) => b.timestampMs - a.timestampMs);

  fetched.forEach((item, idx) => {
    item.no = fetched.length - idx;
  });

  window.rawFirestorePosts = fetched;
  window.combinedPosts = [...fetched];

  renderCommunityTable();
}

window.fetchCommunityPosts = fetchCommunityPosts;

/**
 * [한글 주석: 카테고리 수치 및 게시판 목록 테이블 렌더링 함수]
 */
function renderCommunityTable() {
  const posts = window.combinedPosts || [];
  const tbody = document.getElementById("cafe-post-tbody");
  const totalCountEl = document.getElementById("total-count-display");
  if (!tbody) return;

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

  let filtered = posts.filter(post => {
    if (currentBoard !== "all" && post.board !== currentBoard) return false;
    if (hideNotice && (post.prefix === "공지" || post.prefix === "필독")) return false;

    if (periodFilter !== "all") {
      const now = Date.now();
      const diffMs = now - post.timestampMs;
      const oneDay = 24 * 60 * 60 * 1000;
      if (periodFilter === "1w" && diffMs > 7 * oneDay) return false;
      if (periodFilter === "1m" && diffMs > 30 * oneDay) return false;
      if (periodFilter === "6m" && diffMs > 180 * oneDay) return false;
      if (periodFilter === "1y" && diffMs > 365 * oneDay) return false;
    }

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

  const totalCount = filtered.length;
  if (totalCountEl) totalCountEl.textContent = `${totalCount.toLocaleString()}개의 글`;

  if (totalCount === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3.5rem 1rem; color: #64748b; font-size: 0.95rem;">
          등록된 게시글이 없거나 선택한 조건에 부합하는 글이 없습니다.
        </td>
      </tr>
    `;
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pagePosts = filtered.slice(startIndex, startIndex + itemsPerPage);

  tbody.innerHTML = pagePosts.map((post, pIdx) => {
    const globalIdx = window.combinedPosts.indexOf(post);
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

    let secretBadge = "";
    if (post.isSecret || post.board === "resume") {
      secretBadge = `<span style="color: #f59e0b; font-size: 0.8rem; margin-right: 0.3rem;"><i class="fa-solid fa-lock"></i> 비밀글</span>`;
    }

    const commentHtml = post.commentCount > 0 ? `<span class="cafe-comment-cnt">[${post.commentCount}]</span>` : "";
    const newHtml = post.isNew ? `<span class="cafe-new-icon">N</span>` : "";

    return `
      <tr>
        <td class="cafe-post-no">${displayNo}</td>
        <td>
          ${badgeHtml}
          ${secretBadge}
          <a href="#" class="cafe-post-link" onclick="window.showCafeDetailSection(${globalIdx}); return false;">
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

  renderPagination(totalPages);
}

window.renderCommunityTable = renderCommunityTable;

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

window.changeCommunityPage = function(pageNum) {
  currentPage = pageNum;
  renderCommunityTable();
  window.scrollTo({ top: 200, behavior: "smooth" });
};

/**
 * [한글 주석: 게시글 상세 보기 뷰 및 비밀글/이력서 권한 검증 모듈]
 */
function showCafeDetailSection(postIndex) {
  const postListSection = document.getElementById("cafe-post-list-section");
  const postWriteSection = document.getElementById("cafe-post-write-section");
  const postDetailSection = document.getElementById("cafe-post-detail-section");

  if (!postDetailSection) return;

  const post = window.combinedPosts[postIndex];
  if (!post) return;

  const sidebarNameEl = document.getElementById("sidebar-user-name");
  const sidebarRoleBadgeEl = document.getElementById("sidebar-user-badge");
  const currentUserName = sidebarNameEl ? sidebarNameEl.textContent.trim() : "";
  const currentUserBadge = sidebarRoleBadgeEl ? sidebarRoleBadgeEl.textContent.trim() : "";

  const currentUid = auth.currentUser ? auth.currentUser.uid : (window.currentUserUid || "");
  const userRole = (window.currentUserRole || "").toLowerCase();
  const allowedAdminRoles = ["super_admin", "admin", "admin_user"];

  const isAuthor = (currentUid && post.authorUid && currentUid === post.authorUid) ||
                   (currentUserName && post.authorName && currentUserName === post.authorName);
  const isAllowedAdmin = allowedAdminRoles.includes(userRole) ||
                         currentUserBadge.includes("관리자") ||
                         currentUserBadge.includes("최고관리자") ||
                         currentUserName === "최고관리자" ||
                         currentUserName === "관리자";

  const isSecretPost = post.isSecret || post.board === "resume";

  // [한글 주석: 이력서업로드 및 비밀글 열람 권한 차단 - 작성자 본인 및 지정 관리자(super_admin, admin, admin_user) 전용]
  if (isSecretPost && !isAuthor && !isAllowedAdmin) {
    alert("🔒 비밀글입니다. 작성자 본인과 지정된 관리자(super_admin, admin, admin_user) 등급만 열람하실 수 있습니다.");
    return;
  }

  if (postListSection) postListSection.style.display = "none";
  if (postWriteSection) postWriteSection.style.display = "none";
  postDetailSection.style.display = "block";

  const currentVal = parseInt(post.rawViews || post.views || "1", 10);
  post.rawViews = currentVal + 1;
  post.views = String(post.rawViews);

  if (typeof window.renderCommunityTable === "function") {
    window.renderCommunityTable();
  }

  if (post.id && !post.id.startsWith("local-")) {
    try {
      updateDoc(doc(db, "community_posts", post.id), {
        views: post.rawViews
      }).catch(() => {});
    } catch (e) {}
  }

  const boardNames = {
    notice: "📢 공지사항",
    clinic: "🏥 병원정보",
    insurance: "🛡️ 보험정보",
    visa: "🛂 비자정보",
    job: "💼 구인구직",
    resume: "📄 이력서업로드"
  };
  const boardLabel = boardNames[post.board] || "📋 커뮤니티";

  let authorActionsHtml = "";
  if (isAuthor || isAllowedAdmin) {
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

    <div style="background: rgba(10, 15, 30, 0.9); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 14px; padding: 1.5rem; color: #f1f5f9; font-size: 1rem; line-height: 1.8; word-break: break-word; min-height: 200px;">
      ${post.contentHtml ? post.contentHtml : `${escapeHtml(post.content).replace(/\n/g, '<br>')}${inBodyPhotosHtml}`}
      ${filesHtml}
      ${tagsHtml}
    </div>

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

window.openImageLightbox = function(src) {
  const existing = document.getElementById("image-lightbox-modal");
  if (existing) existing.remove();

  const html = `
    <div id="image-lightbox-modal" onclick="this.remove()" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.92); align-items: center; justify-content: center; z-index: 100000; padding: 1.5rem; cursor: zoom-out;">
      <div style="position: relative; max-width: 95vw; max-height: 95vh; text-align: center;">
        <img src="${src}" style="max-width: 95vw; max-height: 88vh; border-radius: 14px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); border: 1px solid rgba(0,243,255,0.5); object-fit: contain;" alt="원본 이미지">
        <div style="color: #00f3ff; font-size: 0.95rem; font-weight: 700; margin-top: 0.75rem;"><i class="fa-solid fa-xmark"></i> 클릭하면 화면이 닫힙니다</div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
};

window.editPost = function(postIndex) {
  const post = window.combinedPosts[postIndex];
  if (!post) return;

  window.editingPostId = post.id;

  const boardSelect = document.getElementById("write-board-select");
  const prefixSelect = document.getElementById("write-prefix-select");
  const titleInput = document.getElementById("write-title-input");
  const contentInput = document.getElementById("write-content-input");
  const contentEditor = document.getElementById("write-content-editor");
  const tagsInput = document.getElementById("write-tags-input");

  if (boardSelect) boardSelect.value = post.board || "notice";
  if (prefixSelect) prefixSelect.value = post.prefix || "일반";
  if (titleInput) titleInput.value = post.title || "";
  if (contentInput) contentInput.value = post.content || "";
  if (tagsInput) tagsInput.value = post.tags || "";

  if (contentEditor) {
    if (post.contentHtml) {
      contentEditor.innerHTML = post.contentHtml;
    } else {
      let editorHtml = escapeHtml(post.content || "").replace(/\n/g, "<br>");
      if (post.photos && post.photos.length > 0) {
        editorHtml += post.photos.map(p => `
          <div class="editor-inline-image-wrap" contenteditable="false" style="margin: 1.25rem 0; text-align: center; user-select: none;">
            <div style="position: relative; display: inline-block; max-width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0, 243, 255, 0.4); box-shadow: 0 8px 24px rgba(0,0,0,0.5); background: rgba(10, 15, 30, 0.9);">
              <img src="${p.dataUrl}" style="max-width: 100%; max-height: 550px; object-fit: contain; display: block;" alt="${escapeHtml(p.name || '이미지')}">
            </div>
          </div>
          <p><br></p>
        `).join("");
      }
      contentEditor.innerHTML = editorHtml;
    }
  }

  window.attachedPhotos = post.photos ? [...post.photos] : [];
  window.attachedFiles = post.files ? [...post.files] : [];

  renderPhotoPreviews();
  renderFilePreviews();

  showCafeWriteSection();

  const submitBtnTop = document.getElementById("btn-submit-cafe-post");
  const submitBtnBottom = document.getElementById("btn-submit-cafe-post-bottom");
  if (submitBtnTop) submitBtnTop.textContent = "수정 완료";
  if (submitBtnBottom) submitBtnBottom.textContent = "수정 완료";
};

window.deletePost = async function(postIndex) {
  const post = window.combinedPosts[postIndex];
  if (!post) return;

  if (!confirm(`'${post.title}' 게시글을 정말 삭제하시겠습니까?\n삭제된 데이터는 deleted_community_posts 백업 보관소에 보존됩니다.`)) {
    return;
  }

  try {
    await addDoc(collection(db, "deleted_community_posts"), {
      originalPostId: post.id || "",
      board: post.board || "notice",
      prefix: post.prefix || "일반",
      title: post.title || "",
      content: post.content || "",
      tags: post.tags || "",
      authorName: post.authorName || "",
      deletedAt: serverTimestamp()
    });
  } catch (e) {}

  if (post.id && !post.id.startsWith("local-")) {
    try {
      await deleteDoc(doc(db, "community_posts", post.id));
    } catch (e) {}
  }

  alert("게시글이 성공적으로 삭제되었습니다.");
  showCafeListSection();
  fetchCommunityPosts();
};

async function submitNewPost() {
  const currentUser = auth.currentUser;
  const sidebarName = document.getElementById("sidebar-user-name")?.textContent;
  const authorName = currentUser?.displayName || (sidebarName && sidebarName !== "회원님" ? sidebarName : "가입회원");

  const boardEl = document.getElementById("write-board-select");
  const prefixEl = document.getElementById("write-prefix-select");
  const titleEl = document.getElementById("write-title-input");
  const contentEl = document.getElementById("write-content-input");
  const editorEl = document.getElementById("write-content-editor");
  const tagsEl = document.getElementById("write-tags-input");

  const board = boardEl ? boardEl.value : "notice";
  const prefix = prefixEl ? prefixEl.value : "일반";
  const title = titleEl ? titleEl.value.trim() : "";
  const content = editorEl && editorEl.innerText ? editorEl.innerText.trim() : (contentEl ? contentEl.value.trim() : "");
  const contentHtml = editorEl ? editorEl.innerHTML : content.replace(/\n/g, "<br>");
  const tags = tagsEl ? tagsEl.value.trim() : "";

  if (!title || !content) {
    alert("제목과 내용을 모두 입력해 주세요.");
    return false;
  }

  const now = new Date();
  const dateStr = now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + String(now.getDate()).padStart(2, "0") + ".";

  const photos = [...(window.attachedPhotos || [])];
  const files = [...(window.attachedFiles || [])];

  const authorUid = currentUser ? currentUser.uid : (window.currentUserUid || "");
  const isSecret = board === "resume";

  try {
    if (window.editingPostId && !window.editingPostId.startsWith("local-")) {
      await updateDoc(doc(db, "community_posts", window.editingPostId), {
        board, prefix, title, content, contentHtml, isSecret, tags, photos, files
      });
      window.editingPostId = null;
      alert("게시글이 성공적으로 수정되었습니다.");
    } else {
      await addDoc(collection(db, "community_posts"), {
        board, prefix, title, content, contentHtml, isSecret, authorUid, tags,
        authorName, commentCount: 0, views: 1, dateStr,
        createdAt: serverTimestamp(), photos, files
      });
      alert("게시글이 성공적으로 등록되었습니다!");
    }

    if (titleEl) titleEl.value = "";
    if (contentEl) contentEl.value = "";
    if (editorEl) editorEl.innerHTML = "";
    if (tagsEl) tagsEl.value = "";
    window.attachedPhotos = [];
    window.attachedFiles = [];
    renderPhotoPreviews();
    renderFilePreviews();

    showCafeListSection();
    fetchCommunityPosts();
  } catch (err) {
    console.error("게시글 저장 중 예외 발생:", err);
    alert("저장 중 오류가 발생했습니다: " + err.message);
  }
  return false;
}

window.submitNewPost = submitNewPost;

function initEventHandlers() {
  const menuItems = document.querySelectorAll(".cafe-menu-item");
  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(m => m.classList.remove("active"));
      item.classList.add("active");

      currentBoard = item.getAttribute("data-board");
      currentPage = 1;

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

  const chkNotice = document.getElementById("chk-hide-notice");
  if (chkNotice) {
    chkNotice.addEventListener("change", (e) => {
      hideNotice = e.target.checked;
      currentPage = 1;
      renderCommunityTable();
    });
  }

  const selectPerPage = document.getElementById("select-per-page");
  if (selectPerPage) {
    selectPerPage.addEventListener("change", (e) => {
      itemsPerPage = parseInt(e.target.value, 10) || 15;
      currentPage = 1;
      renderCommunityTable();
    });
  }

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

  const contentEditor = document.getElementById("write-content-editor");
  if (contentEditor) {
    ["keyup", "mouseup", "focus", "click"].forEach(evtName => {
      contentEditor.addEventListener(evtName, saveEditorSelection);
    });
  }

  const photoInput = document.getElementById("write-photo-input");
  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const imgDataUrl = evt.target.result;
          window.attachedPhotos.push({ name: file.name, dataUrl: imgDataUrl });
          renderPhotoPreviews();
          insertImageAtCursor(imgDataUrl, file.name);
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
          window.attachedFiles.push({ name: file.name, size: sizeKb, dataUrl: evt.target.result });
          renderFilePreviews();
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = "";
    });
  }
}

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

window.renderPhotoPreviews = renderPhotoPreviews;
window.renderFilePreviews = renderFilePreviews;

window.removeAttachedPhoto = function(idx) {
  window.attachedPhotos.splice(idx, 1);
  renderPhotoPreviews();
};

window.removeAttachedFile = function(idx) {
  window.attachedFiles.splice(idx, 1);
  renderFilePreviews();
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
