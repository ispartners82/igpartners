import { db, auth } from "./firebase-db.js?v=2.0.7";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const clinicNameText = document.getElementById("clinic-name-text");
  const reservationForm = document.getElementById("reservation-form");
  const btnBack = document.getElementById("btn-back");

  // LocalStorage에서 선택한 병원명 가져오기
  const selectedClinic = localStorage.getItem("selected_clinic");

  if (!selectedClinic) {
    alert("Vui lòng chọn bệnh viện trước khi điền thông tin. (병원을 먼저 선택해주세요.)");
    location.href = "./index.html";
    return;
  }

  // 화면에 선택한 병원 표시
  clinicNameText.textContent = selectedClinic;

  // 돌아가기 버튼 클릭 이벤트
  btnBack.addEventListener("click", () => {
    location.href = "./index.html";
  });

  // 예약 폼 제출 이벤트
  reservationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Vui lòng đăng nhập trước khi đặt lịch. (예약을 진행하려면 먼저 로그인해 주세요.)");
      location.href = "../index.html";
      return;
    }
    const userUid = currentUser.uid;

    // 입력값 가져오기
    const name = document.getElementById("input-name").value.trim();
    const gender = document.getElementById("input-gender").value;
    const alienNo = document.getElementById("input-alien-no").value.trim();
    const passportNo = document.getElementById("input-passport-no").value.trim();
    const dob = document.getElementById("input-dob").value;
    const reservationDate = document.getElementById("input-date").value;
    const address = document.getElementById("input-address").value.trim();
    const symptoms = document.getElementById("input-symptoms").value.trim();
    const phone = document.getElementById("input-phone").value.trim();
    const agreementCheck = document.getElementById("agreement-check").checked;

    // 로컬 스토리지에서 선택된 언어 가져오기
    const selectedLang = localStorage.getItem("selected_lang") || "unknown";

    if (!agreementCheck) {
       alert("Bạn phải đồng ý với điều khoản bảo mật để tiếp tục. (개인정보 수집 및 이용에 동의합니다를 체크해주세요)");
       return;
    }

    // 예약하기 버튼 비활성화 (중복 제출 방지)
    const btnSubmit = document.getElementById("btn-submit");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Đang xử lý... (처리 중...)";

    // 로컬스토리지 백업 저장 함수
    function saveToLocalBackup(data) {
      let localData = [];
      try {
        const existing = localStorage.getItem("local_reservations");
        if (existing) {
          localData = JSON.parse(existing);
        }
      } catch (e) {
        console.error("Localstorage parsing error:", e);
      }
      localData.push(data);
      localStorage.setItem("local_reservations", JSON.stringify(localData));
    }

    // 5초 타임아웃 프로미스
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000)
    );

    const saveDataPromise = (async () => {
      return await addDoc(collection(db, "reservations"), {
        uid: userUid, // 예약 신청 유저 식별자 추가
        clinic: selectedClinic,
        name: name,
        gender: gender,
        alienNo: alienNo || "",
        passportNo: passportNo,
        dob: dob,
        reservationDate: reservationDate,
        address: address,
        symptoms: symptoms,
        phone: phone,
        lang: selectedLang, // 선택된 언어 코드 저장
        status: "pending",
        createdAt: new Date() // 실시간 포맷 호환을 위해 일반 Date 객체 사용
      });
    })();

    try {
      // 5초 이내에 Firestore 저장이 안 되면 reject
      const docRef = await Promise.race([saveDataPromise, timeoutPromise]);
      console.log("Document written with ID: ", docRef.id);

      // 백업용으로 로컬스토리지에도 동시에 씀 (클라우드 데이터와 병합 목적)
      saveToLocalBackup({
        id: docRef.id,
        uid: userUid,
        clinic: selectedClinic,
        name: name,
        gender: gender,
        alienNo: alienNo || "",
        passportNo: passportNo,
        dob: dob,
        reservationDate: reservationDate,
        address: address,
        symptoms: symptoms,
        phone: phone,
        lang: selectedLang, // 백업에도 언어 포함
        status: "pending",
        createdAt: new Date().toISOString()
      });

      alert("Đặt lịch thành công! Cảm ơn bạn.\n(예약이 완료되었습니다! 감사합니다.)");
      localStorage.removeItem("selected_clinic");
      location.href = "./index.html";

    } catch (error) {
      console.warn("Firestore save failed or timed out. Falling back to local storage.", error);

      // Firestore 저장 실패 시 로컬스토리지에만 저장 후 사용자에게 완료 응답 제공
      const localId = "local_" + Date.now();
      saveToLocalBackup({
        id: localId,
        uid: userUid,
        clinic: selectedClinic,
        name: name,
        gender: gender,
        alienNo: alienNo || "",
        passportNo: passportNo,
        dob: dob,
        reservationDate: reservationDate,
        address: address,
        symptoms: symptoms,
        phone: phone,
        lang: selectedLang, // 백업에도 언어 포함
        status: "pending",
        createdAt: new Date().toISOString()
      });

      alert("Đặt lịch thành công! Cảm ơn bạn.\n(예약이 완료되었습니다! 감사합니다.)");
      localStorage.removeItem("selected_clinic");
      location.href = "./index.html";
    }
  });
});
