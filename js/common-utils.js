/**
 * 프로젝트 전반에서 공통으로 사용하는 보안(XSS 방어), 이미지 압축, 날짜 포맷팅,
 * 페이지네이션, 드래그 앤 드롭 정렬 및 솔라피 인증 유틸리티 모듈
 */

/**
 * XSS 공격 방지를 위한 HTML 특수문자 이스케이프 함수
 * @param {*} str - 변환할 원본 문자열 또는 값
 * @returns {string} 안전하게 이스케이프된 문자열
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * href, src 등 URL 속성에 삽입될 문자열에서 위험 스킴(javascript:, vbscript:, data:text/html 등)을 차단합니다.
 * @param {string} url - 검증할 URL 또는 DataURL 문자열
 * @param {string} [fallback=""] - 안전하지 않을 때 반환할 대체 문자열
 * @returns {string} 검증 및 이스케이프된 안전한 URL
 */
export function sanitizeUrl(url, fallback = "") {
  if (!url) return fallback;
  const trimmed = String(url).trim();
  if (!trimmed) return fallback;

  // 제어문자 및 공백 제거 후 스킴 검사
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
  const isSafeHttp = normalized.startsWith("http://") || normalized.startsWith("https://");
  const isSafeRelative = trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../");
  const isSafeImageDataUrl = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i.test(normalized);
  // 첨부파일 다운로드용 안전한 DataURL 허용 (한컴오피스 .hwp/.hwpx, MS Office vnd.*, 압축/문서, 빈 MIME 포함, HTML/SVG 실행형 제외)
  const isSafeFileDataUrl = /^data:(?:(?:application\/(?:pdf|msword|rtf|hwp|x-hwp|haansofthwp|x-hwpx|zip|x-zip-compressed|x-7z-compressed|x-rar-compressed|octet-stream|vnd\.[a-z0-9.+-]+)|text\/(?:plain|csv))(?:;charset=[a-z0-9-]+)?)?;base64,[a-z0-9+/=]+$/i.test(normalized);

  if (isSafeHttp || isSafeRelative || isSafeImageDataUrl || isSafeFileDataUrl) {
    return trimmed;
  }
  return fallback;
}

/**
 * 커뮤니티 리치 에디터 HTML(contentHtml) 렌더링 전 위험한 태그·이벤트 핸들러·스크립트 URL을 제거하는 정화 함수
 * @param {string} rawHtml - DB에서 불러온 HTML 본문
 * @returns {string} XSS 요소가 제거된 안전한 HTML 문자열
 */
export function sanitizeRichHtml(rawHtml) {
  if (!rawHtml) return "";

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(String(rawHtml), "text/html");

  // 실행 가능한 위험 태그 일괄 제거
  const blockedTags = ["script", "iframe", "object", "embed", "style", "link", "meta", "base", "form", "svg", "math"];
  blockedTags.forEach((tag) => {
    parsedDoc.body.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // 본문 내 인라인 이미지 삭제 버튼(에디터 잔여물)이 읽기 뷰에 남지 않도록 정리하되, 허용 속성만 남깁니다.
  const allowedAttrs = new Set(["class", "style", "src", "href", "alt", "title", "target", "rel", "contenteditable"]);

  const walkAndSanitize = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // 모든 속성 검사: on* 이벤트 핸들러 및 허용되지 않은 속성 제거
    Array.from(node.attributes).forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith("on") || !allowedAttrs.has(attrName)) {
        node.removeAttribute(attr.name);
        return;
      }

      if (attrName === "src" || attrName === "href") {
        const safe = sanitizeUrl(attr.value, "");
        if (!safe) {
          node.removeAttribute(attr.name);
        } else {
          node.setAttribute(attr.name, safe);
          if (attrName === "href" && node.tagName === "A") {
            node.setAttribute("rel", "noopener noreferrer");
          }
        }
      }

      if (attrName === "style") {
        const styleVal = attr.value;
        // CSS 표현식 및 javascript: URL 차단
        if (/expression\s*\(|javascript:|vbscript:|behavior\s*:/i.test(styleVal)) {
          node.removeAttribute("style");
        }
      }
    });

    Array.from(node.children).forEach(walkAndSanitize);
  };

  Array.from(parsedDoc.body.children).forEach(walkAndSanitize);
  return parsedDoc.body.innerHTML;
}

/**
 * 이미지 파일(File/Blob) 또는 DataURL을 Canvas로 리사이징 및 JPEG 압축하는 통합 유틸리티
 * @param {File|Blob|string} inputData - 원본 이미지 파일 또는 DataURL
 * @param {Object} [options] - 압축 설정 옵션
 * @param {number} [options.maxDimension=900] - 최대 가로/세로 픽셀
 * @param {number} [options.quality=0.75] - JPEG 품질 (0 ~ 1)
 * @param {number} [options.targetWidth] - 고정 출력 너비 (스마트 크롭 모드용)
 * @param {number} [options.targetHeight] - 고정 출력 높이 (스마트 크롭 모드용)
 * @param {boolean} [options.portraitTopCrop=false] - 인물 사진 상단 15% 가중치 크롭 여부
 * @returns {Promise<string>} 압축된 JPEG DataURL
 */
export function compressImageFile(inputData, options = {}) {
  const {
    maxDimension = 900,
    quality = 0.75,
    targetWidth = 0,
    targetHeight = 0,
    portraitTopCrop = false
  } = options;

  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl) => {
      if (!dataUrl) {
        resolve("");
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (targetWidth > 0 && targetHeight > 0) {
          // 고정 비율 스마트 크롭 (예: 통역사 3:4 명함 사진)
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          const targetRatio = targetWidth / targetHeight;
          const imgRatio = img.width / img.height;
          let srcX = 0;
          let srcY = 0;
          let srcW = img.width;
          let srcH = img.height;

          if (imgRatio > targetRatio) {
            srcW = img.height * targetRatio;
            srcX = (img.width - srcW) / 2;
          } else {
            srcH = img.width / targetRatio;
            srcY = portraitTopCrop ? Math.max(0, (img.height - srcH) * 0.15) : (img.height - srcH) / 2;
          }

          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);
        } else {
          // 비율 유지 축소 리사이징
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
        }

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("이미지를 불러오는 데 실패했습니다."));
      img.src = dataUrl;
    };

    if (typeof inputData === "string") {
      processDataUrl(inputData);
    } else if (inputData instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => processDataUrl(e.target.result);
      reader.onerror = () => reject(new Error("파일 읽기에 실패했습니다."));
      reader.readAsDataURL(inputData);
    } else {
      resolve("");
    }
  });
}

/**
 * Firestore Timestamp, {seconds}, ISO 문자열, Date 객체를 한국어 날짜 문자열로 안전 변환합니다.
 * @param {*} dateVal - 변환 대상 날짜 값
 * @param {Intl.DateTimeFormatOptions} [formatOptions] - toLocaleString / toLocaleDateString 옵션
 * @param {boolean} [dateOnly=false] - 날짜만 출력할지 여부
 * @returns {string} 포맷팅된 날짜 문자열 (실패 시 "-")
 */
export function formatFirestoreDate(dateVal, formatOptions = null, dateOnly = false) {
  if (!dateVal) return "-";
  let jsDate = null;

  if (typeof dateVal.toDate === "function") {
    jsDate = dateVal.toDate();
  } else if (typeof dateVal === "object" && dateVal.seconds) {
    jsDate = new Date(dateVal.seconds * 1000);
  } else {
    jsDate = new Date(dateVal);
  }

  if (!jsDate || isNaN(jsDate.getTime())) return "-";
  if (dateOnly) {
    return jsDate.toLocaleDateString("ko-KR", formatOptions || { year: "numeric", month: "short", day: "numeric" });
  }
  return jsDate.toLocaleString("ko-KR", formatOptions || undefined);
}

/**
 * 관리자 테이블(회원 리스트, 문자발송 대상 리스트 등) 공용 페이지네이션 컨트롤러를 렌더링합니다.
 * @param {HTMLElement} container - 페이지네이션이 렌더링될 컨테이너 요소
 * @param {Object} params - 페이지네이션 설정값
 */
export function renderPaginationControls(container, { totalItems, itemsPerPage, currentPage, infoPrefix = "전체", onPageChange }) {
  if (!container) return;
  if (totalItems <= 0) {
    container.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  let html = `
    <div class="admin-pagination-info">
      ${escapeHtml(infoPrefix)} <strong>${totalItems}</strong>명 (페이지 <strong>${currentPage}</strong> / ${totalPages})
    </div>
    <div class="admin-pagination">
      <button type="button" class="admin-page-btn btn-first" ${currentPage <= 1 ? "disabled" : ""} title="첫 페이지">«</button>
      <button type="button" class="admin-page-btn btn-prev" ${currentPage <= 1 ? "disabled" : ""} title="이전 페이지">‹</button>
  `;

  for (let p = startPage; p <= endPage; p++) {
    html += `<button type="button" class="admin-page-btn btn-num ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
  }

  html += `
      <button type="button" class="admin-page-btn btn-next" ${currentPage >= totalPages ? "disabled" : ""} title="다음 페이지">›</button>
      <button type="button" class="admin-page-btn btn-last" ${currentPage >= totalPages ? "disabled" : ""} title="마지막 페이지">»</button>
    </div>
  `;

  container.innerHTML = html;

  const btnFirst = container.querySelector(".btn-first");
  const btnPrev = container.querySelector(".btn-prev");
  const btnNext = container.querySelector(".btn-next");
  const btnLast = container.querySelector(".btn-last");

  if (btnFirst && !btnFirst.disabled) btnFirst.addEventListener("click", () => onPageChange(1));
  if (btnPrev && !btnPrev.disabled) btnPrev.addEventListener("click", () => onPageChange(Math.max(1, currentPage - 1)));
  if (btnNext && !btnNext.disabled) btnNext.addEventListener("click", () => onPageChange(Math.min(totalPages, currentPage + 1)));
  if (btnLast && !btnLast.disabled) btnLast.addEventListener("click", () => onPageChange(totalPages));

  container.querySelectorAll(".btn-num").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetPage = parseInt(btn.getAttribute("data-page"), 10);
      if (targetPage && targetPage !== currentPage) {
        onPageChange(targetPage);
      }
    });
  });
}

/**
 * 테이블 행(`tr`)의 HTML5 드래그 앤 드롭 순서 변경 및 콜백 실행을 공통으로 바인딩합니다.
 * @param {HTMLElement} tbodyEl - 대상 tbody 요소
 * @param {Object} options - 행 클래스, 순번 셀렉터 및 순서 변경 콜백
 */
export function initTableDragReorder(tbodyEl, { rowClass, orderNumSelector, onReorder }) {
  if (!tbodyEl || tbodyEl.dataset.dragReorderBound === "true") return;
  tbodyEl.dataset.dragReorderBound = "true";

  let draggedRow = null;

  tbodyEl.addEventListener("dragstart", (e) => {
    if (e.target.closest("button, a, input, select, textarea")) {
      e.preventDefault();
      return;
    }
    const row = e.target.closest(`.${rowClass}`);
    if (!row) return;

    draggedRow = row;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", row.getAttribute("data-id") || "");
    setTimeout(() => {
      if (draggedRow) draggedRow.classList.add("dragging");
    }, 0);
  });

  tbodyEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!draggedRow) return;

    const targetRow = e.target.closest(`.${rowClass}`);
    if (!targetRow || targetRow === draggedRow) return;

    const rect = targetRow.getBoundingClientRect();
    const isAfter = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
    tbodyEl.insertBefore(draggedRow, isAfter ? targetRow.nextSibling : targetRow);
  });

  tbodyEl.addEventListener("dragend", async () => {
    if (!draggedRow) return;
    draggedRow.classList.remove("dragging");
    draggedRow = null;

    const rows = tbodyEl.querySelectorAll(`.${rowClass}`);
    if (!rows || rows.length === 0) return;

    const reorderPayload = [];
    let hasChanges = false;

    rows.forEach((row, index) => {
      const id = row.getAttribute("data-id");
      const oldOrder = parseInt(row.getAttribute("data-order") || "0", 10);
      const newOrder = index + 1;

      const orderNumEl = row.querySelector(orderNumSelector);
      if (orderNumEl) orderNumEl.textContent = newOrder;
      if (oldOrder !== newOrder) hasChanges = true;

      row.setAttribute("data-order", newOrder);
      reorderPayload.push({ id, order: oldOrder, newOrder });
    });

    if (hasChanges && typeof onReorder === "function") {
      await onReorder(reorderPayload, rows.length);
    }
  });
}

/**
 * 솔라피(Solapi) API 호출용 HMAC-SHA256 인증 헤더를 Web Crypto API로 생성합니다.
 * @param {string} apiKey - Solapi API Key
 * @param {string} apiSecret - Solapi API Secret
 * @returns {Promise<string>} Authorization 헤더 값
 */
export async function createSolapiAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 15);

  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const messageData = encoder.encode(date + salt);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await window.crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * 예약 통역요청 여부('네' / '아니오')를 테이블 셀용 배지 HTML로 변환하는 공용 헬퍼
 * @param {string} val - 저장된 통역요청 값 ('네', '아니오' 등)
 * @returns {string} 안전하게 이스케이프된 배지 HTML 또는 '-'
 */
export function formatInterpretationBadge(val) {
  const raw = String(val || "").trim();
  if (raw === "네") {
    return `<span class="badge badge-interp-yes">네</span>`;
  }
  if (raw === "아니오") {
    return `<span class="badge badge-interp-no">아니오</span>`;
  }
  return raw ? escapeHtml(raw) : "-";
}
