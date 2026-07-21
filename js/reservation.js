import { db, auth } from "./firebase-db.js?v=2.0.7";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * 폼 라벨, 힌트문구, 모달 및 다국어 팝업 얼럿을 다각도로 처리하기 위한 사전 정의
 */
const i18n = {
  // 한국어 진료 예약 폼 UI 텍스트
  ko: {
    formTitle: "진료 예약 정보 입력",
    formSubtitle: "예약을 신속하게 완료하기 위해 아래 폼을 정확하게 작성해 주세요.",
    bookingAt: "📅 예약 진행 병원:",
    noClinic: "병원을 먼저 선택해 주셔야 예약을 진행할 수 있습니다. (병원 선택 화면으로 복귀합니다.)",
    loginRequired: "예약을 진행하려면 먼저 로그인이 필요합니다.",
    labelName: "이름 (여권 영문 성명) *",
    placeholderName: "예: HONG GILDONG",
    labelGender: "성별 *",
    genderPlaceholder: "성별을 선택해 주세요",
    genderMale: "남성",
    genderFemale: "여성",
    labelVisaType: "비자 타입 *",
    placeholderVisaType: "예: C-3-9, D-2, E-9 등",
    labelAlienNo: "외국인등록번호 (소지 시 기재)",
    placeholderAlienNo: "예: 950101-1****** (뒷자리 첫번호만 기재 가능)",
    labelVisaExpiry: "체류 만료일 *",
    labelDob: "생년월일 *",
    labelDate: "진료 희망 예약 날짜 *",
    labelAddress: "현재 체류 주소 *",
    placeholderAddress: "예: 서울특별시 강남구 테헤란로 123",
    labelSymptoms: "현재 증상 *",
    placeholderSymptoms: "진료를 원하시는 주요 증상을 자세히 기재해 주세요 (예: 치통, 피부 발진, 감기 등)",
    labelPhone: "연락처 *",
    placeholderPhone: "예: 010-1234-5678",
    agreementLabel: "개인정보 수집 및 이용에 동의합니다.",
    openPrivacy: "[자세히 보기]",
    btnBack: "돌아가기",
    btnSubmit: "예약 신청하기",
    submitting: "처리 중...",
    submitSuccess: "진료 예약 신청이 성공적으로 접수되었습니다.\n관리자 승인 후 가입하신 이메일 또는 연락처로 신속히 안내 연락드리겠습니다. 감사합니다.",
    submitError: "예약 신청 처리 도중 예기치 못한 시스템 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.",
    agreeRequired: "개인정보 수집 및 이용 약관에 동의해 주셔야 예약을 신청하실 수 있습니다.",
    privacyTitle: "🔒 개인정보 처리방침"
  },
  // 베트남어 진료 예약 폼 UI 텍스트
  vi: {
    formTitle: "Nhập Thông Tin Đặt Lịch",
    formSubtitle: "Vui lòng điền đầy đủ thông tin bên dưới để tiến hành đặt lịch hẹn.",
    bookingAt: "📅 Đang đặt lịch tại:",
    noClinic: "Vui lòng chọn bệnh viện trước khi điền thông tin. (Quay lại trang chọn bệnh viện.)",
    loginRequired: "Vui lòng đăng nhập trước khi đặt lịch.",
    labelName: "Họ và tên (Khớp với Hộ chiếu) *",
    placeholderName: "Ví dụ: NGUYEN VAN A",
    labelGender: "Giới tính *",
    genderPlaceholder: "Chọn giới tính",
    genderMale: "Nam",
    genderFemale: "Nữ",
    labelVisaType: "Loại Visa *",
    placeholderVisaType: "Ví dụ: C-3-9",
    labelAlienNo: "Số đăng ký người nước ngoài",
    placeholderAlienNo: "Ví dụ: 950101-2******",
    labelVisaExpiry: "Ngày hết hạn lưu trú *",
    labelDob: "Ngày sinh *",
    labelDate: "Ngày đặt lịch *",
    labelAddress: "Địa chỉ hiện tại *",
    placeholderAddress: "Ví dụ: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "Triệu chứng hiện tại *",
    placeholderSymptoms: "Vui lòng mô tả chi tiết các triệu chứng của bạn (ví dụ: đau răng, ngứa da,...)",
    labelPhone: "Số điện thoại *",
    placeholderPhone: "Ví dụ: 010-1234-5678",
    agreementLabel: "Tôi đồng ý với việc thu thập và sử dụng thông tin cá nhân.",
    openPrivacy: "[Xem chi tiết]",
    btnBack: "Quay lại",
    btnSubmit: "Đặt lịch",
    submitting: "Đang xử lý...",
    submitSuccess: "Đăng ký đặt lịch hẹn của bạn đã được ghi nhận thành công.\nChúng tôi sẽ liên hệ lại sau khi quản trị viên phê duyệt. Xin cảm ơn.",
    submitError: "Đã xảy ra lỗi trong quá trình đặt lịch.\nVui lòng thử lại sau.",
    agreeRequired: "Bạn phải đồng ý với chính sách bảo mật để tiếp tục đặt lịch.",
    privacyTitle: "🔒 Chính sách bảo mật"
  },
  // 영어 진료 예약 폼 UI 텍스트
  en: {
    formTitle: "Enter Booking Details",
    formSubtitle: "Please fill out all the fields below to proceed with your clinic appointment.",
    bookingAt: "📅 Booking at:",
    noClinic: "Please select a clinic before entering information. (Returning to clinic selection page.)",
    loginRequired: "Please sign in before booking an appointment.",
    labelName: "Full Name (matching Passport) *",
    placeholderName: "e.g. HONG GILDONG",
    labelGender: "Gender *",
    genderPlaceholder: "Select your gender",
    genderMale: "Male",
    genderFemale: "Female",
    labelVisaType: "Visa Type *",
    placeholderVisaType: "e.g. C-3-9, D-2",
    labelAlienNo: "Alien Registration Number (ARC, if held)",
    placeholderAlienNo: "e.g. 950101-2******",
    labelVisaExpiry: "Visa Expiry Date *",
    labelDob: "Date of Birth *",
    labelDate: "Preferred Appointment Date *",
    labelAddress: "Current Address in Korea *",
    placeholderAddress: "e.g. Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "Current Symptoms *",
    placeholderSymptoms: "Please describe your symptoms in detail (e.g. toothache, skin rash, cold, etc.)",
    labelPhone: "Phone Number *",
    placeholderPhone: "e.g. 010-1234-5678",
    agreementLabel: "I agree to the collection and use of personal information.",
    openPrivacy: "[View Details]",
    btnBack: "Go Back",
    btnSubmit: "Book Appointment",
    submitting: "Processing...",
    submitSuccess: "Your appointment request has been submitted successfully.\nWe will contact you shortly after administrator approval. Thank you.",
    submitError: "An error occurred during submission.\nPlease try again later.",
    agreeRequired: "You must agree to the privacy policy to proceed with booking.",
    privacyTitle: "🔒 Privacy Policy"
  },
  // 일본어 진료 예약 폼 UI 텍스트
  ja: {
    formTitle: "診療予約情報入力",
    formSubtitle: "予約を迅速に完了するために、以下のフォームを正確に入力してください。",
    bookingAt: "📅 予約進行中の病院:",
    noClinic: "予約を進行するには、先に病院を選択する必要があります。（病院選択画面に戻ります。）",
    loginRequired: "予約を進めるにはログインしてください。",
    labelName: "お名前 (パスポート英語表記と同じ) *",
    placeholderName: "例: HONG GILDONG",
    labelGender: "性別 *",
    genderPlaceholder: "性別を選択してください",
    genderMale: "男性",
    genderFemale: "女性",
    labelVisaType: "ビザの種類 *",
    placeholderVisaType: "例: C-3-9, D-2",
    labelAlienNo: "外国人登録番号 (所持している場合のみ記載)",
    placeholderAlienNo: "例: 950101-1******",
    labelVisaExpiry: "在留期間満了日 *",
    labelDob: "生年月日 *",
    labelDate: "予約希望일 *",
    labelAddress: "韓国内の現住所 *",
    placeholderAddress: "例: ソウル市江南区テヘラン路123",
    labelSymptoms: "現在の症状 *",
    placeholderSymptoms: "ご希望の主な症状を詳しく記入してください（例: 歯痛、湿疹、風邪など）",
    labelPhone: "ご連絡先 (携帯電話番号) *",
    placeholderPhone: "例: 010-1234-5678",
    agreementLabel: "個人情報の収集および利用に同意します。",
    openPrivacy: "[詳細表示]",
    btnBack: "戻る",
    btnSubmit: "予約する",
    submitting: "処理中...",
    submitSuccess: "診療予約の申請が正常に受理されました。\n管理者の承認後、ご登録のアドレスまたは連絡先にご案内いたします。ありがとうございます。",
    submitError: "予約申請の処理中にエラーが発生しました。\nしばらくしてからもう一度お試しください。",
    agreeRequired: "個人情報の収集および利用に関する利用規約に同意していただく必要があります。",
    privacyTitle: "🔒 個人情報保護方針"
  },
  // 중국어 진료 예약 폼 UI 텍스트
  zh: {
    formTitle: "输入诊疗预约信息",
    formSubtitle: "请准确填写以下表格，以便快速完成您的预约。",
    bookingAt: "📅 正在预约的医院:",
    noClinic: "您必须先选择医院才能进行预约。（正在返回选择医院页面。）",
    loginRequired: "进行预约前需要先登录。",
    labelName: "姓名 (与护照英文姓名一致) *",
    placeholderName: "例如: HONG GILDONG",
    labelGender: "性别 *",
    genderPlaceholder: "请选择性别",
    genderMale: "男",
    genderFemale: "女",
    labelVisaType: "签证类型 *",
    placeholderVisaType: "例如: C-3-9, D-2, E-9 等",
    labelAlienNo: "外国人登录号 (如有请填写)",
    placeholderAlienNo: "例如: 950101-1******",
    labelVisaExpiry: "滞留到期日 *",
    labelDob: "出生日期 *",
    labelDate: "希望诊疗的预约日期 *",
    labelAddress: "当前居住地址 *",
    placeholderAddress: "例如: 首尔特别市江南区德黑兰路 123",
    labelSymptoms: "当前症状 *",
    placeholderSymptoms: "请详细填写您想要诊疗的主要症状 (例如: 牙痛、皮疹、感冒等)",
    labelPhone: "联系电话 *",
    placeholderPhone: "例如: 010-1234-5678",
    agreementLabel: "我同意收集和使用个人信息。",
    openPrivacy: "[查看详情]",
    btnBack: "返回",
    btnSubmit: "申请预约",
    submitting: "处理中...",
    submitSuccess: "您的诊疗预约申请已成功提交。\n管理员批准后，我们将通过您注册的邮箱或联系电话尽快通知您。谢谢。",
    submitError: "预约申请处理过程中发生意外系统错误。\n请稍后再试。",
    agreeRequired: "您必须同意个人信息收集和使用条款才能申请预约。",
    privacyTitle: "🔒 隐私政策"
  },
  // 러시아어 진료 예약 폼 UI 텍스트
  ru: {
    formTitle: "Ввод информации для записи на прием",
    formSubtitle: "Пожалуйста, заполните форму ниже точно, чтобы быстро завершить бронирование.",
    bookingAt: "📅 Клиника для записи:",
    noClinic: "Сначала необходимо выбрать клинику для бронирования. (Возврат на страницу выбора клиники.)",
    loginRequired: "Для продолжения бронирования требуется вход в систему.",
    labelName: "Имя (латиницей, как в паспорте) *",
    placeholderName: "Например: HONG GILDONG",
    labelGender: "Пол *",
    genderPlaceholder: "Выберите пол",
    genderMale: "Мужской",
    genderFemale: "Женский",
    labelVisaType: "Тип визы *",
    placeholderVisaType: "Например: C-3-9, D-2, E-9 и т.д.",
    labelAlienNo: "Номер регистрационной карты иностранца (при наличии)",
    placeholderAlienNo: "Например: 950101-1******",
    labelVisaExpiry: "Дата окончания пребывания *",
    labelDob: "Дата рождения *",
    labelDate: "Желаемая дата приема *",
    labelAddress: "Адрес текущего пребывания *",
    placeholderAddress: "Например: Сеул, Каннам-гу, Тегеран-ро 123",
    labelSymptoms: "Текущие симптомы *",
    placeholderSymptoms: "Пожалуйста, подробно опишите основные симптомы (например, зубная боль, кожная сыпь, простуда и т.д.)",
    labelPhone: "Контактный телефон *",
    placeholderPhone: "Например: 010-1234-5678",
    agreementLabel: "Я согласен на сбор и использование персональных данных.",
    openPrivacy: "[Подробнее]",
    btnBack: "Назад",
    btnSubmit: "Отправить заявку",
    submitting: "Обработка...",
    submitSuccess: "Ваша заявка на прием успешно зарегистрирована.\nМы свяжемся с вами по электронной почте или телефону после одобрения администратором. Спасибо.",
    submitError: "Во время обработки вашей заявки произошла системная ошибка.\nПожалуйста, попробуйте позже.",
    agreeRequired: "Вы должны согласиться с политикой конфиденциальности для отправки заявки.",
    privacyTitle: "🔒 Политика конфиденциальности"
  },
  // 미얀마어 진료 예약 폼 UI 텍스트
  my: {
    formTitle: "ဆေးဘက်ဆိုင်ရာ ကြိုတင်ချိန်းဆိုမှု အချက်အလက်များ ထည့်သွင်းခြင်း",
    formSubtitle: "ကြိုတင်ချိန်းဆိုမှုကို လျင်မြန်စွာ အပြီးသတ်ရန် အောက်ပါပုံစံကို တိကျစွာ ဖြည့်စွက်ပေးပါ။",
    bookingAt: "📅 လက်ရှိကြိုတင်ယူနေသော ဆေးရုံ:",
    noClinic: "ကြိုတင်ချိန်းဆိုမှု မလုပ်ဆောင်မီ ပထမဆုံး ဆေးရုံရွေးချယ်ရပါမည်။ (ဆေးရုံရွေးချယ်မှု စာမျက်နှာသို့ ပြန်သွားရန်။)",
    loginRequired: "ကြိုတင်ချိန်းဆိုမှု ပြုလုပ်ရန် လော့ဂ်အင်ဝင်ရန် လိုအပ်ပါသည်။",
    labelName: "အမည် (နိုင်ငံကူးလက်မှတ်ပါ အင်္ဂလိပ်အမည်နှင့် အတူတူ) *",
    placeholderName: "ဥပမာ: HONG GILDONG",
    labelGender: "ကျား/မ *",
    genderPlaceholder: "ကျား/မ ရွေးချယ်ပေးပါ",
    genderMale: "ကျား",
    genderFemale: "မ",
    labelVisaType: "ဗီဇာအမျိုးအစား *",
    placeholderVisaType: "ဥပမာ: C-3-9, D-2, E-9 စသည်ဖြင့်",
    labelAlienNo: "နိုင်ငံခြားသားမှတ်ပုံတင်အမှတ် (ရှိပါက ရေးရန်)",
    placeholderAlienNo: "ဥပမာ: 950101-1******",
    labelVisaExpiry: "ဗီဇာသက်တမ်းကုန်ဆုံးရက် *",
    labelDob: "မွေးသက္ကရာဇ် *",
    labelDate: "ကုသမှုခံယူလိုသော ရက်စွဲ *",
    labelAddress: "လက်ရှိနေရပ်လိပ်စာ *",
    placeholderAddress: "ဥပမာ: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "လက်ရှိရောဂါလက္ခဏာများ *",
    placeholderSymptoms: "ကုသလိုသော အဓိကရောဂါလက္ခဏာများကို အသေးစိတ်ရေးပေးပါ (ဥပမာ: သွားကိုက်ခြင်း၊ အနီစက်များထွက်ခြင်း၊ ဖျားခြင်း စသည်ဖြင့်)",
    labelPhone: "ဆက်သွယ်ရန်ဖုန်းနံပါတ် *",
    placeholderPhone: "ဥပမာ: 010-1234-5678",
    agreementLabel: "ကိုယ်ရေးကိုယ်တာအချက်အလက်များ စုဆောင်းခြင်းနှင့် အသုံးပြုခြင်းကို သဘောတူပါသည်။",
    openPrivacy: "[အသေးစိတ်ကြည့်ရန်]",
    btnBack: "နောက်သို့",
    btnSubmit: "ကြိုတင်ချိန်းဆိုမှု တောင်းဆိုရန်",
    submitting: "လုပ်ဆောင်နေပါသည်...",
    submitSuccess: "ဆေးဘက်ဆိုင်ရာ ကြိုတင်ချိန်းဆိုမှု လျှောက်ထားခြင်း အောင်မြင်ပါသည်။\nမန်နေဂျာမှ အတည်ပြုပြီးနောက် သင်၏ အီးမေးလ် သို့မဟုတ် ဖုန်းနံပါတ်သို့ အမြန်ဆုံး ဆက်သွယ်ပေးပါမည်။ ကျေးဇူးတင်ပါသည်။",
    submitError: "ကြိုတင်လျှောက်ထားမှု လုပ်ဆောင်စဉ် စနစ်အတွင်း အမှားတစ်ခု ဖြစ်ပွားခဲ့သည်။\nခဏအကြာတွင် ထပ်မံကြိုးစားပေးပါ။",
    agreeRequired: "ကိုယ်ရေးကိုယ်တာ သဘောတူညီချက်ကို သဘောတူမှသာ ကြိုတင်လျှောက်ထားနိုင်ပါသည်။",
    privacyTitle: "🔒 ကိုယ်ရေးကိုယ်တာ မူဝါဒ"
  },
  // 캄보디아어 (Khmer) 진료 예약 폼 UI 텍스트
  km: {
    formTitle: "បញ្ចូលព័ត៌មាននៃការកក់ការពិនិត្យ",
    formSubtitle: "សូមបំពេញទម្រង់ខាងក្រោមឱ្យបានត្រឹមត្រូវ ដើម្បីបង្ហើយការកក់របស់អ្នកឱ្យបានរហ័ស។",
    bookingAt: "📅 មន្ទីរពេទ្យកំពុងកក់ទុក:",
    noClinic: "អ្នកត្រូវតែជ្រើសរើសមន្ទីរពេទ្យជាមុនសិន ទើបអាចធ្វើការកក់បាន។ (ត្រឡប់ទៅទំព័រជ្រើសរើសមន្ទីរពេទ្យវិញ។)",
    loginRequired: "សូមចូលគណនីរបស់អ្នកជាមុនសិន ដើម្បីធ្វើការកក់ទុក។",
    labelName: "ឈ្មោះ (ដូចឈ្មោះជាភាសាអង់គ្លេសក្នុងលិខិតឆ្លងដែន) *",
    placeholderName: "ឧទាហរណ៍: HONG GILDONG",
    labelGender: "ភេទ *",
    genderPlaceholder: "សូមជ្រើសរើសភេទ",
    genderMale: "ប្រុស",
    genderFemale: "ស្រី",
    labelVisaType: "ប្រភេទវីហ្សា *",
    placeholderVisaType: "ឧទាហរណ៍: C-3-9, D-2, E-9 ផ្សេងៗ",
    labelAlienNo: "លេខចុះបញ្ជីជនបរទេស (បើមាន)",
    placeholderAlienNo: "ឧទាហរណ៍: 950101-1******",
    labelVisaExpiry: "ថ្ងៃផុតកំណត់ទិដ្ឋាការ *",
    labelDob: "ថ្ងៃខែឆ្នាំកំណើត *",
    labelDate: "ថ្ងៃកក់ទុកពិនិត្យព្យាបាល *",
    labelAddress: "អាសយដ្ឋានបច្ចុប្បន្ន *",
    placeholderAddress: "ឧទាហរណ៍: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "រោគសញ្ញាបច្ចុប្បន្ន *",
    placeholderSymptoms: "សូមពណ៌នាលម្អិតពីរោគសញ្ញាសំខាន់ៗរបស់អ្នក (ឧទាហរណ៍: ឈឺធ្មេញ, កន្ទួលលើស្បែក, គ្រុនផ្តាសាយ ផ្សេងៗ)",
    labelPhone: "លេខទូរស័ព្ទទំនាក់ទំនង *",
    placeholderPhone: "ឧទាហរណ៍: 010-1234-5678",
    agreementLabel: "ខ្ញុំយល់ព្រមចំពោះការប្រមូល និងប្រើប្រាស់ព័ត៌មានផ្ទាល់ខ្លួន។",
    openPrivacy: "[មើលព័ត៌មានលម្អិត]",
    btnBack: "ត្រឡប់ក្រោយ",
    btnSubmit: "ស្នើសុំការកក់",
    submitting: "កំពុងដំណើរការ...",
    submitSuccess: "ការស្នើសុំការកក់របស់អ្នកត្រូវបានបញ្ជូនដោយជោគជ័យ។\nយើងខ្ញុំនឹងទាក់ទងទៅអ្នកវិញតាមរយៈអ៊ីមែល ឬលេខទូរស័ព្ទ បន្ទាប់ពីទទួលបានការអនុម័តពីអ្នកគ្រប់គ្រង។ សូមអរគុណ។",
    submitError: "មានកំហុសប្រព័ន្ធក្នុងការដំណើរការការកក់របស់អ្នក។\nសូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។",
    agreeRequired: "អ្នកត្រូវតែយល់ព្រមនឹងលក្ខខណ្ឌនៃការប្រមូលព័ត៌មានផ្ទាល់ខ្លួនដើម្បីបន្តការកក់។",
    privacyTitle: "🔒 គោលការណ៍ឯកជនភាព"
  },
  // 몽골어 진료 예약 폼 UI 텍스트
  mn: {
    formTitle: "Эмчилгээний захиалгын мэдээлэл оруулах",
    formSubtitle: "Захиалгыг хурдан дуусгахын тулд доорх хуудсыг үнэн зөв бөглөнө үү.",
    bookingAt: "📅 Захиалга хийж буй эмнэлэг:",
    noClinic: "Та эхлээд эмнэлгээ сонгох ёстой. (Эмнэлэг сонгох хуудас руу буцна уу.)",
    loginRequired: "Захиалга өгөхөд нэвтрэх шаардлагатай.",
    labelName: "Нэр (Гадаад паспорт дээрх англи нэртэй ижил) *",
    placeholderName: "Жишээ: HONG GILDONG",
    labelGender: "Хүйс *",
    genderPlaceholder: "Хүйсээ сонгоно уу",
    genderMale: "Эрэгтэй",
    genderFemale: "Эмэгтэй",
    labelVisaType: "Визний төрөл *",
    placeholderVisaType: "Жишээ: C-3-9, D-2, E-9 гэх мэт",
    labelAlienNo: "Алиен картны дугаар (Хэрэв байгаа бол)",
    placeholderAlienNo: "Жишээ: 950101-1******",
    labelVisaExpiry: "Виз сунгалт дуусах хугацаа *",
    labelDob: "Төрсөн огноо *",
    labelDate: "Эмчилгээ хийлгэхийг хүсэж буй огноо *",
    labelAddress: "Одоо оршин сууж буй хаяг *",
    placeholderAddress: "Жишээ: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "Одоо илэрч буй шинж тэмдэг *",
    placeholderSymptoms: "Та өөрийн гол шинж тэмдгүүдээ дэлгэрэнгүй бичнэ үү (Жишээ: шүд өвдөх, тууралт гарах, ханиад хүрэх гэх мэт)",
    labelPhone: "Холбоо барих утас *",
    placeholderPhone: "Жишээ: 010-1234-5678",
    agreementLabel: "Хувийн мэдээлэл цуглуулах, ашиглахыг зөвшөөрч байна.",
    openPrivacy: "[Дэлгэрэнгүй үзэх]",
    btnBack: "Буцах",
    btnSubmit: "Захиалга өгөх",
    submitting: "Уншиж байна...",
    submitSuccess: "Эмчилгээний захиалгын хүсэлт амжилттай илгээгдлээ.\nАдмин баталгаажуулсны дараа таны бүртгүүлсэн имэйл эсвэл утсаар холбоо барих болно. Баярлалаа.",
    submitError: "Захиалгын хүсэлтийг боловсруулах явцад системийн алдаа гарлаа.\nТүр хүлээгээд дахин оролдоно уу.",
    agreeRequired: "Захиалга хийхийн тулд хувийн мэдээллийн нөхцөлийг зөвшөөрөх шаардлагатай.",
    privacyTitle: "🔒 Нууцлалын бодлого"
  },
  // 태국어 진료 예약 폼 UI 텍스트
  th: {
    formTitle: "กรอกข้อมูลการจองเวลาตรวจรักษา",
    formSubtitle: "กรุณากรอกข้อมูลในแบบฟอร์มด้านล่างให้ถูกต้องเพื่อความรวดเร็วในการดำเนินการจอง",
    bookingAt: "📅 โรงพยาบาลที่ทำการจอง:",
    noClinic: "คุณต้องเลือกโรงพยาบาลก่อนที่จะทำการจอง (กำลังกลับสู่หน้าเลือกโรงพยาบาล)",
    loginRequired: "จำเป็นต้องเข้าสู่ระบบก่อนทำการจอง",
    labelName: "ชื่อ-นามสกุล (ตรงกับภาษาอังกฤษในหนังสือเดินทาง) *",
    placeholderName: "เช่น: HONG GILDONG",
    labelGender: "เพศ *",
    genderPlaceholder: "กรุณาเลือกเพศ",
    genderMale: "ชาย",
    genderFemale: "หญิง",
    labelVisaType: "ประเภทวีซ่า *",
    placeholderVisaType: "เช่น: C-3-9, D-2, E-9 เป็นต้น",
    labelAlienNo: "เลขบัตรประจำตัวคนต่างด้าว (หากมี)",
    placeholderAlienNo: "เช่น: 950101-1******",
    labelVisaExpiry: "วันหมดอายุการพำนัก *",
    labelDob: "วันเดือนปีเกิด *",
    labelDate: "วันที่ต้องการจองเข้ารับการตรวจ *",
    labelAddress: "ที่อยู่ปัจจุบันในเกาหลี *",
    placeholderAddress: "เช่น: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "อาการปัจจุบัน *",
    placeholderSymptoms: "กรุณาระบุอาการหลักที่คุณต้องการตรวจอย่างละเอียด (เช่น ปวดฟัน, ผื่นผิวหนัง, เป็นหวัด เป็นต้น)",
    labelPhone: "เบอร์โทรศัพท์ติดต่อ *",
    placeholderPhone: "เช่น: 010-1234-5678",
    agreementLabel: "ข้าพเจ้ายินยอมให้รวบรวมและใช้ข้อมูลส่วนบุคคล",
    openPrivacy: "[ดูรายละเอียด]",
    btnBack: "ย้อนกลับ",
    btnSubmit: "ส่งคำขอจอง",
    submitting: "กำลังดำเนินการ...",
    submitSuccess: "ส่งคำขอจองการตรวจเรียบร้อยแล้ว\nเราจะติดต่อกลับไปทางอีเมลหรือหมายเลขโทรศัพท์หลังจากที่ผู้ดูแลระบบอนุมัติ ขอบคุณค่ะ/ครับ",
    submitError: "เกิดข้อผิดพลาดในการประมวลผลการจอง\nกรุณาลองใหม่อีกครั้งในภายหลัง",
    agreeRequired: "คุณต้องยอมรับข้อตกลงและเงื่อนไขการรวบรวมข้อมูลส่วนบุคคลเพื่อจอง",
    privacyTitle: "🔒 นโยบายความเป็นส่วนตัว"
  },
  // 라오스어 진료 예약 폼 UI 텍스트
  lo: {
    formTitle: "ປ້ອນຂໍ້ມູນການຈອງກວດພະຍາດ",
    formSubtitle: "ກະລຸນາຕື່ມຂໍ້ມູນໃສ່ແບບຟອມລຸ່ມນີ້ໃຫ້ຖືກຕ້ອງເພື່ອດຳເນີນການຈອງໄດ້ໄວຂຶ້ນ.",
    bookingAt: "📅 ໂຮງໝໍທີ່ກຳລັງຈອງ:",
    noClinic: "ທ່ານຕ້ອງເລືອກໂຮງໝໍກ່ອນຈຶ່ງຈະສາມາດຈອງໄດ້. (ກຳລັງກັບໄປໜ້າເລືອກໂຮງໝໍ.)",
    loginRequired: "ຕ້ອງມີການເຂົ້າສູ່ລະບົບກ່ອນເພື່ອເຮັດການຈອງ.",
    labelName: "ຊື່ ແລະ ນາມສະກຸນ (ກົງກັບຊື່ພາສາອັງກິດໃນໜັງສືຜ່ານແດນ) *",
    placeholderName: "ຕົວຢ່າງ: HONG GILDONG",
    labelGender: "ເພດ *",
    genderPlaceholder: "ກະລຸນາເລືອກເພດ",
    genderMale: "ຊາຍ",
    genderFemale: "ຍິງ",
    labelVisaType: "ປະເພດວີຊາ *",
    placeholderVisaType: "ຕົວຢ່າງ: C-3-9, D-2, E-9 ແລະ ອື່ນໆ",
    labelAlienNo: "ເລກບັດປະຈຳຕົວຄົນຕ່າງປະເທດ (ຖ້າມີ)",
    placeholderAlienNo: "ຕົວຢ່າງ: 950101-1******",
    labelVisaExpiry: "ວັນໝົດອາຍຸການພຳນັກ *",
    labelDob: "ວັນເດືອນປີເກີດ *",
    labelDate: "ວັນທີຕ້ອງການນັດໝາຍກວດ *",
    labelAddress: "ທີ່ຢູ່ປະຈຸບັນໃນເກົາຫຼີ *",
    placeholderAddress: "ຕົວຢ່າງ: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "ອາການປະຈຸບັນ *",
    placeholderSymptoms: "ກະລຸນາລະບຸອາການຫຼັກທີ່ທ່ານຕ້ອງການກວດຢ່າງລະອຽດ (ຕົວຢ່າງ: ເຈັບແຂ້ວ, ຕຸ່ມຄັນ, ເປັນຫວັດ ແລະ ອື່ນໆ)",
    labelPhone: "ເບີໂທລະສັບຕິດຕໍ່ *",
    placeholderPhone: "ຕົວຢ່າງ: 010-1234-5678",
    agreementLabel: "ຂ້ອຍຍິນຍອມໃຫ້ເກັບກຳ ແລະ ນຳໃຊ້ຂໍ້ມູນສ່ວນຕົວ.",
    openPrivacy: "[ເບິ່ງລາຍລະອຽດ]",
    btnBack: "ກັບຄືນ",
    btnSubmit: "ສົ່ງຄຳຂໍຈອງ",
    submitting: "ກຳລັງດຳເນີນການ...",
    submitSuccess: "ສົ່ງຄຳຂໍຈອງການກວດພະຍາດຂອງທ່ານສຳເລັດແລ້ວ.\nພວກເຮົາຈະຕິດຕໍ່ກັບຫາທ່ານໂດຍໄວຜ່ານອີເມວ ຫຼື ເບີໂທ ຫຼັງຈາກໄດ້ຮັບການອະນຸມັດຈາກຜູ້ດູແລ. ຂອບໃຈ.",
    submitError: "ເກີດຂໍ້ຜິດພາດໃນລະບົບໃນລະຫວ່າງການປະມວນຜົນການຈອງ.\nກະລຸນາລອງໃໝ່ອີກຄັ້ງໃນພາຍຫຼັງ.",
    agreeRequired: "ທ່ານຕ້ອງຍອມຮັບຂໍ້ຕົກລົງຄວາມເປັນສ່ວນຕົວເພື່ອດຳເນີນການຈອງ.",
    privacyTitle: "🔒 ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ"
  },
  // 네팔어 진료 예약 폼 UI 텍스트
  ne: {
    formTitle: "उपचार बुकिङ विवरण प्रविष्ट गर्नुहोस्",
    formSubtitle: "बुकिङ द्रुत रूपमा पूरा गर्न कृपया तलको फारम सही रूपमा भर्नुहोस्।",
    bookingAt: "📅 बुकिङ भइरहेको अस्पताल:",
    noClinic: "बुकिङ गर्न पहिले अस्पताल छनोट गर्नुपर्छ। (अस्पताल छनोट पृष्ठमा फर्किँदै।)",
    loginRequired: "बुकिङ गर्न लगइन आवश्यक छ।",
    labelName: "नाम (राहदानीको अंग्रेजी नामसँग मिल्ने) *",
    placeholderName: "जस्तै: HONG GILDONG",
    labelGender: "लिङ्ग *",
    genderPlaceholder: "लिङ्ग छनोट गर्नुहोस्",
    genderMale: "पुरुष",
    genderFemale: "महिला",
    labelVisaType: "भिसा प्रकार *",
    placeholderVisaType: "जस्तै: C-3-9, D-2, E-9 आदि",
    labelAlienNo: "एलियन दर्ता नम्बर (भएमा उल्लेख गर्नुहोस्)",
    placeholderAlienNo: "जस्तै: 950101-1******",
    labelVisaExpiry: "बसाई अवधि समाप्ति मिति *",
    labelDob: "जन्ममिति *",
    labelDate: "उपचार गराउन चाहेको मिति *",
    labelAddress: "हालको ठेगाना *",
    placeholderAddress: "जस्तै: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "हालको लक्षणहरू *",
    placeholderSymptoms: "कृपया आफ्नो मुख्य लक्षणहरू विस्तृत रूपमा लेख्नुहोस् (जस्तै: दाँत दुख्ने, छालामा डाबर आउने, रुघाखोकी आदि)",
    labelPhone: "सम्पर्क नम्बर *",
    placeholderPhone: "जस्तै: 010-1234-5678",
    agreementLabel: "म व्यक्तिगत विवरण संकलन र प्रयोगमा सहमत छु।",
    openPrivacy: "[विवरण हेर्नुहोस्]",
    btnBack: "फर्किनुहोस्",
    btnSubmit: "बुकिङ अनुरोध गर्नुहोस्",
    submitting: "प्रक्रियामा...",
    submitSuccess: "बुकिङ अनुरोध सफलतापूर्वक दर्ता भएको छ।\nप्रशासकले स्वीकृत गरेपछि हामी तपाईंको ईमेल वा फोन नम्बरमा सम्पर्क गर्नेछौं। धन्यवाद।",
    submitError: "बुकिङ अनुरोध गर्दा प्रणालीमा त्रुटि देखा पर्यो।\nकृपया केही समयपछि पुन: प्रयास गर्नुहोस्।",
    agreeRequired: "बुकिङ गर्न व्यक्तिगत विवरण प्रयोगका सर्तहरूमा सहमत हुनुपर्छ।",
    privacyTitle: "🔒 गोपनीयता नीति"
  },
  // 인도네시아어 진료 예약 폼 UI 텍스트
  id: {
    formTitle: "Masukkan Informasi Reservasi Medis",
    formSubtitle: "Silakan isi formulir di bawah ini dengan akurat untuk menyelesaikan reservasi Anda dengan cepat.",
    bookingAt: "📅 Klinik Reservasi Saat Ini:",
    noClinic: "Anda harus memilih klinik terlebih dahulu sebelum dapat melanjutkan reservasi. (Kembali ke halaman pemilihan klinik.)",
    loginRequired: "Diperlukan masuk log terlebih dahulu sebelum melakukan reservasi.",
    labelName: "Nama Lengkap (sesuai paspor) *",
    placeholderName: "contoh: HONG GILDONG",
    labelGender: "Jenis Kelamin *",
    genderPlaceholder: "Pilih jenis kelamin",
    genderMale: "Laki-laki",
    genderFemale: "Perempuan",
    labelVisaType: "Jenis Visa *",
    placeholderVisaType: "contoh: C-3-9, D-2, E-9 dll.",
    labelAlienNo: "Nomor Registrasi Orang Asing (bila ada)",
    placeholderAlienNo: "contoh: 950101-1******",
    labelVisaExpiry: "Tanggal Kedaluwarsa Tinggal *",
    labelDob: "Tanggal Lahir *",
    labelDate: "Tanggal Reservasi Medis yang Diinginkan *",
    labelAddress: "Alamat Tinggal Saat Ini *",
    placeholderAddress: "contoh: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "Gejala Saat Ini *",
    placeholderSymptoms: "Jelaskan secara detail gejala medis utama Anda (contoh: sakit gigi, ruam kulit, batuk pilek, dll.)",
    labelPhone: "Nomor Telepon *",
    placeholderPhone: "contoh: 010-1234-5678",
    agreementLabel: "Saya menyetujui pengumpulan dan penggunaan informasi pribadi.",
    openPrivacy: "[Lihat Detail]",
    btnBack: "Kembali",
    btnSubmit: "Ajukan Reservasi",
    submitting: "Memproses...",
    submitSuccess: "Permohonan reservasi medis Anda berhasil diajukan.\nKami akan segera menghubungi Anda melalui email atau nomor telepon yang terdaftar setelah mendapat persetujuan admin. Terima kasih.",
    submitError: "Terjadi kesalahan sistem yang tidak terduga saat memproses reservasi.\nSilakan coba lagi nanti.",
    agreeRequired: "Anda harus menyetujui syarat pengumpulan dan penggunaan informasi pribadi untuk mengajukan reservasi.",
    privacyTitle: "🔒 Kebijakan Privasi"
  },
  // 스리랑카어 (Sinhala) 진료 예약 폼 UI 텍스트
  si: {
    formTitle: "වෛද්‍ය හමුව වෙන්කිරීමේ තොරතුරු",
    formSubtitle: "වෙන්කරවා ගැනීම ඉක්මනින් අවසන් කිරීම සඳහා කරුණාකර පහත පෝරමය නිවැරදිව පුරවන්න.",
    bookingAt: "📅 වෙන්කරවා ගන්නා රෝහල:",
    noClinic: "වෙන්කරවා ගැනීමට පෙර ඔබ රෝහලක් තෝරාගත යුතුය. (රෝහල් තේරීමේ පිටුවට ආපසු යයි.)",
    loginRequired: "වෙන්කරවා ගැනීම සඳහා ප්‍රථමයෙන් ලොග් වීම අවශ්‍ය වේ.",
    labelName: "නම (විදේශ ගමන් බලපත්‍රයේ සඳහන් පරිදි) *",
    placeholderName: "උදා: HONG GILDONG",
    labelGender: "ස්ත්‍රී/පුරුෂ භාවය *",
    genderPlaceholder: "ස්ත්‍රී/පුරුෂ භාවය තෝරන්න",
    genderMale: "පිරිමි",
    genderFemale: "ගැහැණු",
    labelVisaType: "වීසා වර්ගය *",
    placeholderVisaType: "උදා: C-3-9, D-2, E-9 ආදී වශයෙන්",
    labelAlienNo: "විදේශික ලියාපදිංචි අංකය (තිබේ නම් පමණක්)",
    placeholderAlienNo: "උදා: 950101-1******",
    labelVisaExpiry: "රැඳී සිටීමේ කාලය අවසන් වන දිනය *",
    labelDob: "උපන් දිනය *",
    labelDate: "ප්‍රතිකාර සඳහා වෙන්කරවා ගැනීමට බලාපොරොත්තු වන දිනය *",
    labelAddress: "දැනට පදිංචි ලිපිනය *",
    placeholderAddress: "උදා: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "දැනට පවතින රෝග ලක්ෂණ *",
    placeholderSymptoms: "ඔබට පවතින ප්‍රධාන රෝග ලක්ෂණ විස්තරාත්මකව සඳහන් කරන්න (උදා: දත් කැක්කුම, සමේ පලු දැමීම, සෙම්ප්‍රතිශ්‍යාව ආදිය)",
    labelPhone: "தொலைபேசி எண் (සම්බන්ධතා අංකය) *",
    placeholderPhone: "උදා: 010-1234-5678",
    agreementLabel: "පුද්ගලික තොරතුරු රැස් කිරීම සහ භාවිතයට මම එකඟ වෙමි.",
    openPrivacy: "[විස්තර බලන්න]",
    btnBack: "ආපසු යන්න",
    btnSubmit: "වෙන්කිරීම ඉල්ලුම් කරන්න",
    submitting: "ක්‍රියාත්මක වෙමින් පවතී...",
    submitSuccess: "වෛද්‍ය හමුව වෙන්කිරීමේ ඉල්ලීම සාර්ථකව ලියාපදිංචි කරන ලදී.\nපරිපාලක අනුමැතියෙන් පසුව ඔබගේ විද්‍යුත් තැපෑල හෝ දුරකථන අංකය මඟින් ඔබව සම්බන්ධ කරගන්නෙමු. ස්තූතියි.",
    submitError: "ඉල්ලීම ක්‍රියාත්මක කිරීමේදී පද්ධති දෝෂයක් ඇති විය.\nකරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.",
    agreeRequired: "වෙන්කරවා ගැනීම සඳහා කරුණාකර පුද්ගලික තොරතුරු එකඟතාවයට එකඟ වන්න.",
    privacyTitle: "🔒 රහස්‍යතා ප්‍රතිපත්තිය"
  },
  // 방글라데시어 (Bengali) 진료 예약 폼 UI 텍스트
  bn: {
    formTitle: "ডাক্তারের অ্যাপয়েন্টমেন্টের তথ্য দিন",
    formSubtitle: "অ্যাপয়েন্টমেন্টটি দ্রুত সম্পন্ন করতে নিচের ফর্মটি সঠিকভাবে পূরণ করুন।",
    bookingAt: "📅 অ্যাপয়েন্টমেন্টের হাসপাতাল:",
    noClinic: "অ্যাপয়েন্টমেন্ট করতে প্রথমে একটি হাসপাতাল নির্বাচন করুন। (হাসপাতাল নির্বাচন পৃষ্ঠায় ফিরে যাচ্ছে।)",
    loginRequired: "অ্যাপয়েন্টমেন্ট বুক করতে লগইন করা আবশ্যক।",
    labelName: "নাম (পাসপোর্টের ইংরেজি নামের সাথে মিল রেখে) *",
    placeholderName: "যেমন: HONG GILDONG",
    labelGender: "লিঙ্গ *",
    genderPlaceholder: "লিঙ্গ নির্বাচন করুন",
    genderMale: "পুরুষ",
    genderFemale: "মহিলা",
    labelVisaType: "ভিসার ধরণ *",
    placeholderVisaType: "যেমন: C-3-9, D-2, E-9 ইত্যাদি",
    labelAlienNo: "এলিয়েন রেজিস্ট্রেশন নম্বর (যদি থাকে)",
    placeholderAlienNo: "যেমন: 950101-1******",
    labelVisaExpiry: "থাকার মেয়াদ শেষের তারিখ *",
    labelDob: "জন্ম তারিখ *",
    labelDate: "চিকিৎসার কাঙ্ক্ষিত তারিখ *",
    labelAddress: "বর্তমান বসবাসের ঠিকানা *",
    placeholderAddress: "যেমন: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "বর্তমান লক্ষণসমূহ *",
    placeholderSymptoms: "আপনার প্রধান লক্ষণগুলো বিস্তারিত লিখুন (যেমন: দাঁত ব্যথা, ত্বকে ফুসকুড়ি, ঠান্ডা লাগা ইত্যাদি)",
    labelPhone: "যোগাযোগের ফোন নম্বর *",
    placeholderPhone: "যেমন: 010-1234-5678",
    agreementLabel: "আমি ব্যক্তিগত তথ্য সংগ্রহ এবং ব্যবহারের জন্য সম্মত আছি।",
    openPrivacy: "[বিস্তারিত দেখুন]",
    btnBack: "ফিরে যান",
    btnSubmit: "অ্যাপয়েন্টমেন্টের আবেদন করুন",
    submitting: "প্রক্রিয়াধীন...",
    submitSuccess: "আপনার অ্যাপয়েন্টমেন্টের আবেদনটি সফলভাবে জমা হয়েছে।\nঅ্যাডমিন অনুমোদনের পর খুব শীঘ্রই আপনার ইমেল বা ফোন নম্বরে যোগাযোগ করা হবে। ধন্যবাদ।",
    submitError: "আবেদন প্রক্রিয়া করার সময় সিস্টেমে কোনো ত্রুটি দেখা দিয়েছে।\nঅনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
    agreeRequired: "অ্যাপয়েন্টমেন্ট বুকিং করতে ব্যক্তিগত তথ্য সংগ্রহের নীতিতে সম্মত হতে হবে।",
    privacyTitle: "🔒 গোপনীয়তা নীতি"
  }
};

/**
 * 개인정보 약관 텍스트 (다국어 렌더링용)
 */
const privacyContents = {
  ko: `
    <div class="privacy-section">
      <h3>📌 개인정보 수집 목적 및 중요성</h3>
      <p>의료 안전 확보 및 한국 병원에서의 정확한 진료 접수 절차 이행을 위해 제공하는 정보는 다음과 같은 중대한 가치를 가집니다:</p>
      <ul>
        <li><strong>성명 및 성별:</strong> 환자의 신원을 정확히 식별하고, 병원 전자의무기록(EMR)의 중복을 예방합니다.</li>
        <li><strong>생년월일 및 신원식별자(체류기간):</strong> 한국 의료법 및 출입국관리법에 따른 외국인 환자 진료 접수 시 필수적인 법적 본인 식별 정보입니다.</li>
        <li><strong>연락처 및 주소:</strong> 예약 확정 안내 송신, 병원 일정 변동에 대한 비상 소통용입니다.</li>
        <li><strong>현재 증상:</strong> 사전 진료 분과 배정 및 맞춤형 진료를 위한 중요 의료 정보로 보안 하에 전송됩니다.</li>
      </ul>
    </div>
  `,
  vi: `
    <div class="privacy-section">
      <h3>📌 Mục đích và Tầm quan trọng của việc thu thập thông tin</h3>
      <p>Để đảm bảo an toàn y tế và thực hiện đúng thủ tục tiếp nhận tại bệnh viện Hàn Quốc, các thông tin bạn cung cấp có vai trò đặc biệt quan trọng như sau:</p>
      <ul>
        <li><strong>Họ và tên, Giới tính:</strong> Xác định chính xác danh tính bệnh nhân, ngăn ngừa nhầm lẫn hồ sơ bệnh án (EMR).</li>
        <li><strong>Ngày sinh, Số hộ chiếu/Số đăng ký người nước ngoài:</strong> Đây là phương thức xác thực danh tính bắt buộc theo Luật Y tế Hàn Quốc.</li>
        <li><strong>Số điện thoại, Địa chỉ hiện tại:</strong> Dùng để gửi thông báo xác nhận lịch hẹn, liên lạc khẩn cấp khi có thay đổi.</li>
        <li><strong>Triệu chứng hiện tại:</strong> Giúp đội ngũ y tế đánh giá sơ bộ mức độ nghiêm trọng và phân bổ phòng khám phù hợp.</li>
      </ul>
    </div>
  `,
  en: `
    <div class="privacy-section">
      <h3>📌 Purpose and Importance of Collecting Information</h3>
      <p>In order to ensure medical safety and complete accurate reception procedures at Korean clinics, the information you provide plays an important role:</p>
      <ul>
        <li><strong>Full Name, Gender:</strong> To accurately identify patients and prevent duplicate electronic medical records (EMR).</li>
        <li><strong>DOB & Identification (Visa expiry):</strong> Required identification for medical registration under Korean Medical Law and Immigration Law.</li>
        <li><strong>Phone Number, Current Address:</strong> For appointment confirmation, emergency contact regarding schedule changes.</li>
        <li><strong>Current Symptoms:</strong> Crucial medical data for proper clinical department pre-assignment and preparation.</li>
      </ul>
    </div>
  `,
  // 일본어 개인정보 처리방침 내용
  ja: `
    <div class="privacy-section">
      <h3>📌 個人情報収集の目的と重要性</h3>
      <p>医療安全の確保および韓国の病院における正確な診療受付手続き履行のため、提供された情報は以下の通り極めて重要な役割を持ちます：</p>
      <ul>
        <li><strong>氏名および性別:</strong> 患者の身元を正確に特定し、電子カルテ（EMR）の重複や誤りを防ぎます。</li>
        <li><strong>生年月日および外国人登録番号:</strong> 韓国の医療法に基づく外国人患者診療受付時の必須かつ法的な本人確認情報です。</li>
        <li><strong>連絡先および住所:</strong> 予約確定案内の送付、病院都合による予約スケジュールの緊急連絡先です。</li>
        <li><strong>現在の症状:</strong> 事前診療科の決定および個別診療準備のための、厳格に管理される情報です。</li>
      </ul>
    </div>
  `,
  // 중국어 개인정보 처리방침 내용
  zh: `
    <div class="privacy-section">
      <h3>📌 收集个人信息的目的和重要性</h3>
      <p>为确保医疗安全并在韩国医院履行准确的诊疗登记手续，您提供的信息具有以下重要价值：</p>
      <ul>
        <li><strong>姓名和性别：</strong> 准确识别患者身份，防止医院电子病历(EMR)重复。</li>
        <li><strong>出生日期和身份标识（滞留期）：</strong> 根据韩国医疗法和出入境管理法，这是外国患者登记时必需的法定身份识别信息。</li>
        <li><strong>联系电话和地址：</strong> 用于发送预约确认通知及医院行程变动的紧急沟通。</li>
        <li><strong>当前症状：</strong> 作为预先分配诊疗科室及提供个性化诊疗的重要医疗信息，将在安全保护下传输。</li>
      </ul>
    </div>
  `,
  // 러시아어 개인정보 처리방침 내용
  ru: `
    <div class="privacy-section">
      <h3>📌 Цель и важность сбора персональных данных</h3>
      <p>Для обеспечения медицинской безопасности и точного соблюдения процедур регистрации пациентов в корейских клиниках предоставляемая вами информация имеет следующую ценность:</p>
      <ul>
        <li><strong>ФИО и пол:</strong> Для точной идентификации пациента и предотвращения дублирования электронных медицинских карт (EMR).</li>
        <li><strong>Дата рождения и идентификатор личности (срок пребывания):</strong> Обязательная юридическая идентификационная информация при регистрации иностранных пациентов в соответствии с медицинским законодательством Кореи.</li>
        <li><strong>Контактный телефон и адрес:</strong> Для отправки подтверждения бронирования и экстренной связи в случае изменения расписания клиники.</li>
        <li><strong>Текущие симптомы:</strong> Важная медицинская информация для предварительного распределения по отделениям и индивидуальной подготовки к приему, передаваемая в условиях безопасности.</li>
      </ul>
    </div>
  `,
  // 미얀마어 개인정보 처리방침 내용
  my: `
    <div class="privacy-section">
      <h3>📌 ကိုယ်ရေးကိုယ်တာအချက်အလက်များ စုဆောင်းရခြင်း၏ ရည်ရွယ်ချက်နှင့် အရေးကြီးပုံ</h3>
      <p>ဆေးဘက်ဆိုင်ရာ ဘေးကင်းလုံခြုံမှုကို သေချาစေရန်နှင့် ကိုရီးယားဆေးရုံများတွင် တိကျသော ဆေးကုသမှုခံယူခွင့် လက်ခံခြင်းလုပ်ငန်းစဉ်များကို ဆောင်ရွက်ရန် သင်ပေးအပ်သောအချက်အလက်များသည် အောက်ပါအတိုင်း အရေးကြီးပါသည်:</p>
      <ul>
        <li><strong>အမည်နှင့် ကျား/မ:</strong> လူနာ၏ မည်သူမည်ဝါဖြစ်ကြောင်း တိကျစွာ ခွဲခြားသတ်မှတ်ရန်နှင့် ဆေးရုံ၏ အီလက်ထရွန်နစ်ဆေးဘက်ဆိုင်ရာမှတ်တမ်း (EMR) ထပ်နေခြင်းကို ကာကွယ်ရန်။</li>
        <li><strong>မွေးသက္ကရာဇ်နှင့် မည်သူမည်ဝါဖြစ်ကြောင်း သက်သေခံချက် (ဗီဇာသက်တမ်း):</strong> ကိုရီးယား ဆေးဘက်ဆိုင်ရာဥပဒေနှင့် လူဝင်မှုကြီးကြပ်ရေးဥပဒေအရ နိုင်ငံခြားသားလူနာများ ဆေးကုသမှုခံယူရန် လက်ခံရာတွင် မဖြစ်မနေလိုအပ်သော တရားဝင် ကိုယ်ရေးကိုယ်တာ သက်သေခံအချက်အလက်များ ဖြစ်သည်။</li>
        <li><strong>ဆက်သွယ်ရန်ဖုန်းနှင့် လိပ်စာ:</strong> ကြိုတင်ချိန်းဆိုမှု အတည်ပြုချက်ပေးပို့ရန်နှင့် ဆေးရုံအချိန်ဇယား ပြောင်းလဲမှုများအတွက် အရေးပေါ် ဆက်သွယ်ရန်။</li>
        <li><strong>လက်ရှိရောဂါလက္ခဏာများ:</strong> သင့်တော်သော ကုသမှုဌาန ကြိုတင်သတ်မှတ်ရန်နှင့် ကိုက်ညီသော ဆေးကုသမှုပေးရန်အတွက် အရေးကြီးသော ကျန်းမာရေးဆိုင်ရာ အချက်အလက်များဖြစ်ပြီး လုံခြုံစွာ ပေးပို့သွားမည်။</li>
      </ul>
    </div>
  `,
  // 캄보디아어 개인정보 처리방침 내용
  km: `
    <div class="privacy-section">
      <h3>📌 គោលបំណង និងសារៈសំខាន់នៃការប្រមូលព័ត៌មានផ្ទាល់ខ្លួន</h3>
      <p>ដើម្បីធានាសុវត្ថិภาพវេជ្ជសាស្ត្រ និងអនុវត្តនីតិវិធីចុះឈ្មោះព្យាបាលឱ្យបានត្រឹមត្រូវនៅមន្ទីរពេទ្យកូរ៉េ ព័ត៌មានដែលអ្នកផ្តល់ជូនមានតម្លៃសំខាន់ៗដូចខាងក្រោម៖</p>
      <ul>
        <li><strong>ឈ្មោះ និងភេទ៖</strong> ដើម្បីកំណត់អត្តសញ្ញาណអ្នកជំងឺឱ្យបានច្បាស់លាស់ និងការពារការស្ទួនគ្នានៃកំណត់ត្រាវេជ្ជសាស្ត្រអេឡិចត្រូនិច (EMR)។</li>
        <li><strong>ថ្ងៃខែឆ្នាំកំណើត និងអត្តសញ្ញាណប័ណ្ណ (រយៈពេលស្នាក់នៅ)៖</strong> ព័ត៌មានអត្តសញ្ញាណផ្លូវច្បាប់ដែលមិនអាចខ្វះបាននៅពេលទទួលចុះឈ្មោះអ្នកជំងឺបរទេស យោងតាមច្បាប់វេជ្ជសាស្ត្រ និងច្បាប់គ្រប់គ្រងអន្តោប្រวេសន៍កូរ៉េ។</li>
        <li><strong>លេខទូរស័ព្ទ និងអាសយដ្ឋាន៖</strong> សម្រាប់ផ្ញើการជូនដំណឹងបញ្ជាក់ការកក់ និងការទំនាក់ទំនងបន្ទាន់សម្រាប់ការផ្លាស់ប្តូរកាលវិភាគមន្ទីរពេទ្យ។</li>
        <li><strong>រោគសញ្ញាបច្ចុប្បน្ន៖</strong> ព័ត៌មានវេជ្ជសាស្ត្រសំខាន់សម្រាប់ការបែងចែកផ្នែកព្យាបាលជាមុន និងការរៀបចំការព្យាបាលសមស្រប ដែលនឹងត្រូវបញ្ជូនក្រោមការការពារសុវត្ថិภาพ។</li>
      </ul>
    </div>
  `,
  // 몽골어 개인정보 처리방침 내용
  mn: `
    <div class="privacy-section">
      <h3>📌 Хувийн мэдээлэл цуглуулах зорилго ба ач холбогдол</h3>
      <p>Эмчилгээний аюулгүй байдлыг хангах, БНСУ-ын эмнэлэгт бүртгүүлэх үйл явцыг үнэн зөв хэрэгжүүлэхийн тулд таны өгсөн мэдээлэл дараах чухал ач холбогдолтой:</p>
      <ul>
        <li><strong>Овог нэр, хүйс:</strong> Өвчтөнийг үнэн зөв тодорхойлж, цахим түүх (EMR) давхардахаас сэргийлнэ.</li>
        <li><strong>Төрсөн огноо, биеийн байцаалт (визний хугацаа):</strong> Солонгосын Эмнэлгийн хууль болон Цагаачлалын хуулийн дагуу гадаад өвчтөнийг бүртгэхэд шаардлагатай хууль ёсны таних тэмдэг юм.</li>
        <li><strong>Холбоо барих утас, хаяг:</strong> Захиалга баталгаажуулах мэдээлэл илгээх, эмнэлгийн цагийн хуваарийн өөрчлөлтийг яаралтай мэдээлэхэд ашиглана.</li>
        <li><strong>Одоогийн шинж тэмдэг:</strong> Урьдчилан эмчилгээний тасаг хуваарилах, өвчтөнд тохирсон эмчилгээ хийхэд шаардлагатай чухал эрүүл мэндийн мэдээлэл бөгөөд аюулгүй байдлын хамгаалалт дор дамжуулагдана.</li>
      </ul>
    </div>
  `,
  // 태국어 개인정보 처리방침 내용
  th: `
    <div class="privacy-section">
      <h3>📌 วัตถุประสงค์และความสำคัญของการเก็บรวบรวมข้อมูลส่วนบุคคล</h3>
      <p>เพื่อความปลอดภัยทางการแพทย์และการลงทะเบียนรักษาที่ถูกต้องในโรงพยาบาลเกาหลี ข้อมูลที่คุณให้มีความสำคัญดังต่อไปนี้:</p>
      <ul>
        <li><strong>ชื่อและเพศ:</strong> ระบุตัวตนของผู้ป่วยได้อย่างถูกต้องและป้องกันการทำประวัติการแพทย์อิเล็กทรอนิกส์ (EMR) ซ้ำซ้อน</li>
        <li><strong>วันเกิดและข้อมูลระบุตัวตน (ระยะเวลาพำนัก):</strong> ข้อมูลระบุตัวตนที่จำเป็นตามกฎหมายสำหรับการลงทะเบียนผู้ป่วยต่างชาติ ตามกฎหมายการแพทย์เกาหลีและกฎหมายตรวจคนเข้าเมือง</li>
        <li><strong>เบอร์ติดต่อและที่อยู่:</strong> ส่งการยืนยันการจองและติดต่อฉุกเฉินในกรณีที่มีการเปลี่ยนแปลงตารางเวลาของโรงพยาบาล</li>
        <li><strong>อาการปัจจุบัน:</strong> ข้อมูลทางการแพทย์ที่สำคัญสำหรับการส่งตัวไปยังแผนกที่ถูกต้องและเตรียมการรักษาเฉพาะบุคคล ซึ่งจะถูกส่งต่อภายใต้ระบบการรักษาความปลอดภัย</li>
      </ul>
    </div>
  `,
  // 라오스어 개인정보 처리방침 내용
  lo: `
    <div class="privacy-section">
      <h3>📌 ຈຸດປະສົງ ແລະ ຄວາມ ສຳຄັນຂອງການເກັບກຳຂໍ້ມູນສ່ວນຕົວ</h3>
      <p>ເພື່ອຮັບປະກັນຄວາມປອດໄພທາງການແພດ ແລະ ການລົງທະບຽນກວດທີ່ຖືກຕ້ອງຢູ່ໂຮງໝໍເກົາຫຼີ, ຂໍ້ມູນທີ່ທ່ານໃຫ້ມີຄວາມສຳຄັນດັ່ງນີ້:</p>
      <ul>
        <li><strong>ຊື່ ແລະ ເພດ:</strong> ເພື່ອລະບຸຕົວຕົນຂອງຄົນເຈັບຢ່າງຖືກຕ້ອງ ແລະ ປ້ອງກັນການຊ້ຳຊ້ອນຂອງປະຫວັດການແພດເອເລັກໂຕຣນິກ (EMR).</li>
        <li><strong>ວັນເດືອນປີເກີດ ແລະ ເອກະສານຢືນຢັນຕົວຕົນ (ໄລຍະເວລາພຳນັກ):</strong> ຂໍ້ມູນການຢືນຢັນຕົວຕົນທີ່ຈຳເປັນຕາມກົດໝາຍໃນການລົງທະບຽນຄົນເຈັບຕ່າງປະເທດ ຕາມກົດໝາຍການແພດເກົາຫຼີ ແລະ ກົດໝາຍກວດຄົນເຂົ້າເມືອງ.</li>
        <li><strong>ເບີຕິດຕໍ່ ແລະ ທີ່ຢູ່:</strong> ເພື່ອສົ່ງແຈ້ງການຢືນຢັນການຈອງ ແລະ ຕິດຕໍ່ສຸກເສີນກ່ຽວກັບການປ່ຽນແປງຕາຕະລາງເວລາຂອງໂຮງໝໍ.</li>
        <li><strong>ອາການປະຈຸບັນ:</strong> ຂໍ້ມູນທາງການແພດທີ່ ສຳຄັນໃນການຈັດສັນພະແນກກວດລ່ວງໜ້າ ແລະ ກຽມການປິ່ນປົວສະເພາະບຸກຄົນ, ຈະຖືກສົ່ງພາຍໃຕ້ລະບົບຮັກສາຄວາມປອດໄພ.</li>
      </ul>
    </div>
  `,
  // 네팔어 개인정보 처리방침 내용
  ne: `
    <div class="privacy-section">
      <h3>📌 व्यक्तिगत विवरण संकलनको उद्देश्य र महत्त्व</h3>
      <p>चिकित्सा सुरक्षा सुनिश्चित गर्न र कोरियाली अस्पतालहरूमा सही दर्ता प्रक्रिया पूरा गर्न तपाईंले उपलब्ध गराउनुभएको विवरणहरूको निम्नानुसार महत्त्वपूर्ण भूमिका रहन्छ:</p>
      <ul>
        <li><strong>नाम र लिङ्ग:</strong> बिरामीको पहिचान सही रूपमा गर्न र अस्पतालको इलेक्ट्रोनिक मेडिकल रेकर्ड (EMR) दोहोरिनबाट रोक्न।</li>
        <li><strong>जन्ममिति र पहिचानकर्ता (बसाई अवधि):</strong> कोरियाली चिकित्सा कानून र अध्यागमन कानून बमोजिम विदेशी बिरामीहरूको दर्ता गर्दा आवश्यक पर्ने कानूनी पहिचान विवरण हो।</li>
        <li><strong>सम्पर्क नम्बर र ठेगाना:</strong> बुकिङ पुष्टि सन्देश पठाउन र अस्पतालको तालिकामा हुने परिवर्तनहरूका बारेमा आपतकालीन सम्पर्क गर्न।</li>
        <li><strong>हालको लक्षणहरू:</strong> उपचार विभाग पूर्व-निर्धारण गर्न र बिरामी의 आवश्यकता अनुसारको उपचार तयारीका लागि यो महत्त्वपूर्ण चिकित्सा विवरण सुरक्षित रूपमा पठाइनेछ।</li>
      </ul>
    </div>
  `,
  // 인도네시아어 개인정보 처리방침 내용
  id: `
    <div class="privacy-section">
      <h3>📌 Tujuan dan Pentingnya Pengumpulan Informasi Pribadi</h3>
      <p>Untuk memastikan keselamatan medis dan memenuhi prosedur pendaftaran medis yang akurat di rumah sakit Korea, informasi yang Anda berikan memiliki nilai penting sebagai berikut:</p>
      <ul>
        <li><strong>Nama dan Jenis Kelamin:</strong> Mengidentifikasi identitas pasien secara akurat dan mencegah duplikasi rekam medis elektronik (EMR).</li>
        <li><strong>Tanggal Lahir & Identifikasi (Masa Tinggal):</strong> Informasi identifikasi pribadi hukum yang penting saat mendaftarkan pasien asing sesuai dengan Undang-Undang Medis dan Undang-Undang Keimigrasian Korea.</li>
        <li><strong>Nomor Kontak dan Alamat:</strong> Untuk mengirimkan konfirmasi reservasi dan kontak darurat terkait perubahan jadwal rumah sakit.</li>
        <li><strong>Gejala Saat Ini:</strong> Informasi medis penting untuk pra-penugasan departemen medis dan persiapan perawatan yang disesuaikan, ditransmisikan secara aman.</li>
      </ul>
    </div>
  `,
  // 스리랑카어 개인정보 처리방침 내용
  si: `
    <div class="privacy-section">
      <h3>📌 පුද්ගලික තොරතුරු රැස් කිරීමේ අරමුණ සහ වැදගත්කම</h3>
      <p>වෛද්‍යමය ආරක්ෂාව තහවුරු කිරීම සහ කොරියානු රෝහල්වල නිවැරදි ලියාපදිංචි කිරීමේ ක්‍රියාවලිය සම්පූර්ණ කිරීම සඳහා ඔබ සපයන තොරතුරු පහත සඳහන් පරිදි අතිශයින් වැදගත් වේ:</p>
      <ul>
        <li><strong>නම සහ ස්ත්‍රී/පුරුෂ භාවය:</strong> රෝගියා නිවැරදිව හඳුනා ගැනීමට සහ විද්‍යුත් වෛද්‍ය වාර්තා (EMR) අනුපිටපත් වීම වැළැක්වීමට.</li>
        <li><strong>උපන් දිනය සහ රැඳී සිටීමේ කාලය:</strong> කොරියානු වෛද්‍ය නීතිය සහ ආගමන විගමන නීතියට අනුව විදේශීය රෝගීන් ලියාපදිංචි කිරීමේදී අත්‍යවශ්‍ය වන නීතිමය හඳුනාගැනීමේ තොරතුරු වේ.</li>
        <li><strong>දුරකථන අංකය සහ ලිපිනය:</strong> වෙන්කරවා ගැනීම තහවුරු කිරීමේ පණිවිඩ යැවීමට සහ රෝහල් කාලසටහන් වෙනස්වීම් පිළිබඳ හදිසි සන්නිවේදනය සඳහා.</li>
        <li><strong>දැනට පවතින රෝග ලක්ෂණ:</strong> අදාළ වෛද්‍ය අංශය පූර්ව-වෙන් කිරීමට සහ රෝගියාට ගැලපෙන ප්‍රතිකාර සූදානම් කිරීමට අවශ්‍ය වැදගත් වෛද්‍ය තොරතුරු වන අතර ඒවා ආරක්ෂිතව සම්ප්‍රේෂණය වේ.</li>
      </ul>
    </div>
  `,
  // 방글라데시어 개인정보 처리방침 내용
  bn: `
    <div class="privacy-section">
      <h3>📌 व्यक्तिगत তথ্য সংগ্রহের উদ্দেশ্য এবং গুরুত্ব</h3>
      <p>চিকিৎসা নিরাপত্তা নিশ্চিত করতে এবং কোরিয়ান হাসপাতালে সঠিক রেজিস্ট্রেশন প্রক্রিয়া সম্পন্ন করতে আপনার প্রদান করা তথ্য অত্যন্ত গুরুত্বপূর্ণ ভূমিকা পালন করে:</p>
      <ul>
        <li><strong>নাম এবং লিঙ্গ:</strong> রোগীর পরিচয় সঠিকভাবে সনাক্ত করতে এবং হাসপাতালের ইলেকট্রনিক মেডিকেল রেকর্ড (EMR) এর অনুলিপি প্রতিরোধ করতে।</li>
        <li><strong>জন্ম তারিখ এবং পরিচয় (থাকার মেয়াদ):</strong> কোরিয়ান চিকিৎসা আইন ও ইমিগ্রেশন আইন অনুযায়ী বিদেশী রোগীদের রেজিস্ট্রেশনের ক্ষেত্রে এটি একটি আইনগত বাধ্যবাধকতা তথ্য।</li>
        <li><strong>যোগাযোগের নম্বর এবং ঠিকানা:</strong> অ্যাপয়েন্টমেন্ট নিশ্চিতকরণের বিজ্ঞপ্তি পাঠাতেและ হাসপাতালের সময়সূচী পরিবর্তনের জরুরি যোগাযোগের জন্য।</li>
        <li><strong>বর্তমান লক্ষণসমূহ:</strong> বিভাগ নির্ধারণ এবং রোগীর জন্য উপযোগী চিকিৎসার প্রস্তুতির জন্য এটি অত্যন্ত গুরুত্বপূর্ণ তথ্য যা কঠোর নিরাপত্তায় প্রেরণ করা হবে।</li>
      </ul>
    </div>
  `
};

document.addEventListener("DOMContentLoaded", () => {
  // [한글 주석: 카카오 SDK 초기화를 위한 JavaScript 키 정의 (실서비스 적용 시 발급받은 키로 교체해야 합니다.)]
  const KAKAO_JAVASCRIPT_KEY = "YOUR_KAKAO_JAVASCRIPT_KEY";

  if (typeof Kakao !== "undefined") {
    try {
      if (!Kakao.isInitialized()) {
        // [한글 주석: 플레이스홀더 키가 아니고 올바른 키가 설정되어 있을 때만 초기화를 수행합니다.]
        if (KAKAO_JAVASCRIPT_KEY && KAKAO_JAVASCRIPT_KEY !== "YOUR_KAKAO_JAVASCRIPT_KEY") {
          Kakao.init(KAKAO_JAVASCRIPT_KEY);
          console.log("Kakao SDK가 성공적으로 초기화되었습니다.");
        } else {
          console.warn("Kakao SDK가 로드되었으나 JavaScript 키가 설정되지 않았습니다. 'YOUR_KAKAO_JAVASCRIPT_KEY' 부분을 실제 발급받은 키로 수정해 주세요.");
        }
      }
    } catch (err) {
      console.error("Kakao SDK 초기화 중 오류 발생:", err);
    }
  }

  // [한글 주석: 예약 내용을 템플릿화하여 사용자의 카카오톡으로 전송(공유)하는 함수]
  const sendKakaoReservationShare = (name, gender, reservationDate, clinicName, symptoms) => {
    if (typeof Kakao === "undefined" || !Kakao.isInitialized()) {
      console.warn("Kakao SDK가 초기화되지 않았거나 로드되지 않아 카카오톡 공유 발송을 취소합니다.");
      return;
    }

    try {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "📌 IGPartners 진료 예약 신청 완료",
          description: `• 예약자: ${name}님 (${gender})\n• 예약일시: ${reservationDate}\n• 신청병원: ${clinicName}\n• 주요증상: ${symptoms}`,
          imageUrl: window.location.origin + "/img/logo.png",
          link: {
            mobileWebUrl: window.location.origin + "/my-reservations.html",
            webUrl: window.location.origin + "/my-reservations.html",
          },
        },
        buttons: [
          {
            title: "내 예약 내역 확인하기",
            link: {
              mobileWebUrl: window.location.origin + "/my-reservations.html",
              webUrl: window.location.origin + "/my-reservations.html",
            },
          },
        ],
      });
    } catch (err) {
      console.error("카카오톡 메시지 공유 전송 중 예외 발생:", err);
    }
  };

  // [한글 주석: 솔라피(Solapi) API 연동에 필요한 키 정의 및 설정 상수]
  const SOLAPI_API_KEY = "NCS6QTA1RKWBG0P5";         // 솔라피에서 발급받은 API Key
  const SOLAPI_API_SECRET = "YO0S9SMY2XTAKI3ZRH93X7FB4UC0BIGS";   // 솔라피에서 발급받은 API Secret Key
  const SOLAPI_PF_ID = "YOUR_KAKAO_PF_ID";             // 카카오톡 채널 프로필 ID (예: 12345 형식의 솔라피 등록 ID)
  const SOLAPI_TEMPLATE_ID = "YOUR_TEMPLATE_ID";       // 등록 승인 완료된 알림톡 템플릿 ID
  const SOLAPI_SENDER_NUMBER = "YOUR_SENDER_NUMBER";   // 솔라피에 등록 및 발송 등록된 발신번호 (예: 02-123-4567)

  // [한글 주석: 솔라피 API 호출 시 사용할 HMAC-SHA256 인증 헤더 생성 함수 (Web Crypto API 활용)]
  const createSolapiAuthHeader = async (apiKey, apiSecret) => {
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2, 15);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const messageData = encoder.encode(date + salt);

    // HMAC SHA-256 서명 생성
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  };

  // [한글 주석: 솔라피 API를 호출하여 카카오톡 알림톡을 자동 발송하는 비동기 함수]
  const sendSolapiAlimtalk = async (name, gender, reservationDate, clinicName, symptoms, phone) => {
    // [한글 주석: 키 설정이 유효한지 사전 체크]
    if (SOLAPI_API_KEY === "YOUR_SOLAPI_API_KEY" || SOLAPI_API_SECRET === "YOUR_SOLAPI_API_SECRET") {
      console.warn("솔라피 API Key 또는 Secret이 설정되지 않았습니다. 실서비스 연동을 위해 키를 입력해 주세요.");
      return { status: "not_configured", error: "솔라피 API Key/Secret 미설정" };
    }

    // [한글 주석: 알림톡 필수 발송 파라미터가 유효한지 체크]
    if (
      SOLAPI_PF_ID === "YOUR_KAKAO_PF_ID" ||
      SOLAPI_TEMPLATE_ID === "YOUR_TEMPLATE_ID" ||
      SOLAPI_SENDER_NUMBER === "YOUR_SENDER_NUMBER" ||
      !SOLAPI_PF_ID ||
      !SOLAPI_TEMPLATE_ID ||
      !SOLAPI_SENDER_NUMBER
    ) {
      console.warn("카카오톡 프로필 ID, 템플릿 ID, 혹은 발신번호 설정이 플레이스홀더 상태이거나 누락되었습니다.");
      return { status: "not_configured", error: "알림톡 프로필/템플릿/발신번호 미설정" };
    }

    try {
      // API 인증 헤더 생성
      const authHeader = await createSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET);

      // 전화번호 포맷 정규화 (솔라피는 숫자로만 구성된 번호를 권장함)
      const cleanPhone = phone.replace(/[^0-9]/g, "");

      const requestBody = {
        messages: [
          {
            to: cleanPhone,
            from: SOLAPI_SENDER_NUMBER,
            type: "CTA", // 알림톡 타입 지정
            kakaoOptions: {
              pfId: SOLAPI_PF_ID,
              templateId: SOLAPI_TEMPLATE_ID,
              // 템플릿 변수에 맞추어 바인딩 진행 (실제 템플릿 변수명과 일치해야 함)
              variables: {
                "#{이름}": name,
                "#{성별}": gender,
                "#{예약일시}": reservationDate,
                "#{신청병원}": clinicName,
                "#{주요증상}": symptoms.length > 50 ? symptoms.substring(0, 50) + "..." : symptoms,
                "#{연락처}": phone
              }
            }
          }
        ]
      };

      const response = await fetch("https://api.solapi.com/messages/v4/send-many", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.errorMessage || `HTTP status ${response.status}`);
      }

      console.log("알림톡 발송 완료:", responseData);
      return { status: "success" };
    } catch (err) {
      console.error("알림톡 발송 중 예외 오류 발생:", err);
      return { status: "fail", error: err.message };
    }
  };

  const clinicNameText = document.getElementById("clinic-name-text");
  const reservationForm = document.getElementById("reservation-form");
  const btnBack = document.getElementById("btn-back");

  // 1. 현재 로컬스토리지에 설정된 언어셋 확인
  const currentLang = localStorage.getItem("selected_lang") || "vi";
  const dict = i18n[currentLang] || i18n.vi;

  // 2. LocalStorage에서 선택한 병원 영문식별명 및 다국어 렌더링명 가져오기
  const selectedClinic = localStorage.getItem("selected_clinic");
  const selectedClinicLocalized = localStorage.getItem("selected_clinic_localized");

  if (!selectedClinic) {
    alert(dict.noClinic);
    location.href = "/booking-clinic.html";
    return;
  }

  // 화면에 선택한 병원 다국어명 우선 렌더링
  if (clinicNameText) {
    clinicNameText.textContent = selectedClinicLocalized || selectedClinic;
  }

  // 3. UI 폼 텍스트 엘리먼트 다국어 패킹 주입
  const formTitle = document.getElementById("form-page-title");
  const formSubtitle = document.getElementById("form-page-subtitle");
  const bookingBadgeLabel = document.getElementById("booking-badge-label");

  if (formTitle) formTitle.textContent = dict.formTitle;
  if (formSubtitle) formSubtitle.textContent = dict.formSubtitle;
  if (bookingBadgeLabel) bookingBadgeLabel.textContent = dict.bookingAt;

  // 폼 라벨 및 플레이스홀더 동적 매핑
  const mapTextAndPlaceholder = (elId, textVal, placeholderVal = null) => {
    const el = document.getElementById(elId);
    if (el) {
      if (el.tagName === "LABEL") {
        // label 내 필수 표시 span(*) 보존 처리
        el.innerHTML = `${textVal} <span class="required">*</span>`;
      } else {
        el.textContent = textVal;
      }
    }
    if (placeholderVal) {
      const inputEl = document.getElementById(elId.replace("label-", "input-"));
      if (inputEl) inputEl.placeholder = placeholderVal;
    }
  };

  mapTextAndPlaceholder("label-name", dict.labelName, dict.placeholderName);
  mapTextAndPlaceholder("label-gender", dict.labelGender);
  mapTextAndPlaceholder("label-visa-type", dict.labelVisaType, dict.placeholderVisaType);
  mapTextAndPlaceholder("label-alien-no", dict.labelAlienNo.replace(" *", ""), dict.placeholderAlienNo); // 필수 필드 아님
  mapTextAndPlaceholder("label-visa-expiry", dict.labelVisaExpiry);
  mapTextAndPlaceholder("label-dob", dict.labelDob);
  mapTextAndPlaceholder("label-date", dict.labelDate);
  mapTextAndPlaceholder("label-address", dict.labelAddress, dict.placeholderAddress);
  mapTextAndPlaceholder("label-symptoms", dict.labelSymptoms, dict.placeholderSymptoms);
  mapTextAndPlaceholder("label-phone", dict.labelPhone, dict.placeholderPhone);

  // 성별 드롭다운 옵션 번역 주입
  const genderPlaceholder = document.getElementById("gender-placeholder");
  const genderMale = document.getElementById("gender-male");
  const genderFemale = document.getElementById("gender-female");
  if (genderPlaceholder) genderPlaceholder.textContent = dict.genderPlaceholder;
  if (genderMale) genderMale.textContent = dict.genderMale;
  if (genderFemale) genderFemale.textContent = dict.genderFemale;

  // 개인정보 동의 문구 및 상세보기 주입
  const agreementCheck = document.getElementById("agreement-check");
  const agreementLabelText = document.getElementById("agreement-label-text");
  if (agreementLabelText) {
    agreementLabelText.innerHTML = `
      ${dict.agreementLabel}
      <a href="#" id="open-privacy-modal" style="color: #a5b4fc; text-decoration: underline; margin-left: 5px; font-weight: 700;">${dict.openPrivacy}</a>
      <span class="required">*</span>
    `;
  }

  // 액션 단추 번역 주입
  if (btnBack) btnBack.textContent = dict.btnBack;
  const btnSubmit = document.getElementById("btn-submit");
  if (btnSubmit) btnSubmit.textContent = dict.btnSubmit;

  // 돌아가기 버튼 클릭 이벤트
  btnBack.addEventListener("click", () => {
    location.href = "/booking-clinic.html";
  });

  // =========================================================================
  // 4. 개인정보 동의 모달 팝업 제어
  // =========================================================================
  const privacyModal = document.getElementById("privacy-modal");
  const openPrivacyModalBtn = document.getElementById("open-privacy-modal");
  const btnCloseModalX = document.getElementById("btn-close-modal-x");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const privacyModalTitle = document.getElementById("privacy-modal-title");
  const privacyModalBody = document.getElementById("privacy-modal-body-content");

  if (openPrivacyModalBtn && privacyModal) {
    openPrivacyModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // 모달 내용 바인딩
      if (privacyModalTitle) privacyModalTitle.textContent = dict.privacyTitle;
      if (privacyModalBody) privacyModalBody.innerHTML = privacyContents[currentLang] || privacyContents.vi;
      privacyModal.style.display = "flex";
    });
  }

  const hideModal = () => {
    if (privacyModal) privacyModal.style.display = "none";
  };

  if (btnCloseModalX) btnCloseModalX.addEventListener("click", hideModal);
  if (btnCloseModal) btnCloseModal.addEventListener("click", hideModal);

  // 모달 영역 바깥 클릭 시 닫기
  window.addEventListener("click", (e) => {
    if (e.target === privacyModal) {
      hideModal();
    }
  });

  // =========================================================================
  // 5. 예약 폼 제출 이벤트 핸들러
  // =========================================================================
  reservationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentUser = auth.currentUser;
    if (!currentUser) {
      if (typeof window.showLoginModal === "function") {
        window.showLoginModal();
      } else {
        alert(dict.loginRequired);
        location.href = "/index.html";
      }
      return;
    }
    const userUid = currentUser.uid;

    // 입력값 변수 캐싱
    const name = document.getElementById("input-name").value.trim();
    const gender = document.getElementById("input-gender").value;
    const alienNo = document.getElementById("input-alien-no").value.trim();
    const visaType = document.getElementById("input-visa-type").value.trim();
    const visaExpiry = document.getElementById("input-visa-expiry").value;
    const dob = document.getElementById("input-dob").value;
    const reservationDate = document.getElementById("input-date").value;
    const address = document.getElementById("input-address").value.trim();
    const symptoms = document.getElementById("input-symptoms").value.trim();
    const phone = document.getElementById("input-phone").value.trim();
    const isAgreed = document.getElementById("agreement-check").checked;

    if (!isAgreed) {
      alert(dict.agreeRequired);
      return;
    }

    // 예약하기 버튼 비활성화 (중복 제출 방지)
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = dict.submitting;
    }

    try {
      // Firestore에 예약 데이터 저장 (선택된 예약언어 정보 lang 필드 매핑)
      const docRef = await addDoc(collection(db, "reservations"), {
        uid: userUid,
        clinic: selectedClinic, // 영문 식별 병원명 저장
        name: name,
        gender: gender,
        alienNo: alienNo || "",
        visaType: visaType,
        visaExpiry: visaExpiry,
        dob: dob,
        reservationDate: reservationDate,
        address: address,
        symptoms: symptoms,
        // [inflow is initial empty, will be filled in admin page]
        inflow: "",
        phone: phone,
        lang: currentLang, // 예약 진행 언어셋
        status: "pending",
        createdAt: serverTimestamp()
      });

      console.log("Reservation recorded with ID: ", docRef.id);

      // [한글 주석: 예약 신청 완료 후, 입력된 정보를 기반으로 솔라피 API를 통해 카카오 알림톡 자동 전송 실행]
      const alimtalkResult = await sendSolapiAlimtalk(
        name,
        gender,
        reservationDate,
        selectedClinicLocalized || selectedClinic,
        symptoms,
        phone
      );

      // [한글 주석: 알림톡 전송 결과를 Firestore 예약 문서에 기록]
      if (alimtalkResult) {
        try {
          const updateData = {
            alimtalkStatus: alimtalkResult.status
          };
          if (alimtalkResult.error) {
            updateData.alimtalkError = alimtalkResult.error;
          }
          const docDocRef = doc(db, "reservations", docRef.id);
          await updateDoc(docDocRef, updateData);
          console.log("Firestore 예약 문서에 알림톡 결과 업데이트 완료:", updateData);
        } catch (updateErr) {
          console.error("Firestore에 알림톡 발송 상태를 기록하는 중 에러 발생:", updateErr);
        }
      }

      // [한글 주석: 예약 신청 완료 알림 팝업 실행]
      alert(dict.submitSuccess);

      // 성공 시 예약 내역 확인 페이지로 리다이렉트
      location.href = "/my-reservations.html";

    } catch (error) {
      console.error("Error adding reservation: ", error);
      alert(dict.submitError);

      // 버튼 복구
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = dict.btnSubmit;
      }
    }
  });
});
