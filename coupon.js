const COUPON_ENDPOINT = window.GUYO_COUPON_ENDPOINT || "";

const elements = {
  status: document.querySelector("#couponStatus"),
  code: document.querySelector("#couponCode"),
  state: document.querySelector("#couponState"),
};

function getCouponCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = ["gifticon-status", type].filter(Boolean).join(" ");
}

function renderCoupon(data) {
  elements.code.textContent = data.code || getCouponCode() || "-";

  if (!data.ok) {
    elements.state.textContent = "사용 불가";
    setStatus(data.message || "쿠폰 정보를 찾을 수 없습니다.", "is-error");
    return;
  }

  if (data.status === "USED") {
    elements.state.textContent = "사용완료";
    setStatus(`이미 사용된 쿠폰입니다.${data.usedAt ? ` 사용일: ${data.usedAt}` : ""}`, "is-used");
    return;
  }

  if (data.status === "ISSUED") {
    elements.state.textContent = "사용 가능";
    setStatus("사용 가능한 무료 음료 1잔 기프티콘입니다.", "is-valid");
    return;
  }

  elements.state.textContent = "사용 불가";
  setStatus("아직 발급되지 않았거나 사용할 수 없는 쿠폰입니다.", "is-error");
}

async function loadCoupon() {
  const code = getCouponCode();
  elements.code.textContent = code || "-";

  if (!code) {
    elements.state.textContent = "코드 없음";
    setStatus("쿠폰 코드가 없습니다. 문자로 받은 링크를 다시 열어주세요.", "is-error");
    return;
  }

  if (!COUPON_ENDPOINT) {
    elements.state.textContent = "서버 연결 필요";
    setStatus("쿠폰 확인 서버가 연결되지 않았습니다.", "is-error");
    return;
  }

  try {
    const url = new URL(COUPON_ENDPOINT);
    url.searchParams.set("action", "coupon");
    url.searchParams.set("code", code);
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) throw new Error(`Coupon endpoint returned ${response.status}`);
    renderCoupon(await response.json());
  } catch (error) {
    elements.state.textContent = "확인 실패";
    setStatus("쿠폰 상태를 확인하지 못했습니다. 매장 직원에게 코드를 알려주세요.", "is-error");
  }
}

loadCoupon();
