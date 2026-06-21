const COUPON_ENDPOINT = window.GUYO_COUPON_ENDPOINT || "";

const elements = {
  pin: document.querySelector("#staffPin"),
  staffName: document.querySelector("#staffName"),
  storeName: document.querySelector("#storeName"),
  code: document.querySelector("#couponCodeInput"),
  checkButton: document.querySelector("#checkCoupon"),
  redeemButton: document.querySelector("#redeemCoupon"),
  result: document.querySelector("#staffResult"),
};

let lastCheckedCode = "";

function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function getPayload(action) {
  return {
    action,
    pin: elements.pin.value.trim(),
    staffName: elements.staffName.value.trim(),
    storeName: elements.storeName.value.trim(),
    code: normalizeCode(elements.code.value),
  };
}

function validateBaseFields(requireStaff = false) {
  if (!COUPON_ENDPOINT) return "쿠폰 서버가 연결되지 않았습니다.";
  if (!elements.pin.value.trim()) return "직원 PIN을 입력하세요.";
  if (requireStaff && elements.staffName.value.trim().length < 2) return "직원명을 입력하세요.";
  if (requireStaff && elements.storeName.value.trim().length < 2) return "지점/매장을 입력하세요.";
  if (!normalizeCode(elements.code.value)) return "쿠폰 코드를 입력하세요.";
  return "";
}

function setResult(message, type = "") {
  elements.result.textContent = message;
  elements.result.className = ["staff-result", type].filter(Boolean).join(" ");
}

function setRedeemEnabled(enabled) {
  elements.redeemButton.disabled = !enabled;
}

async function postCouponAction(payload) {
  const response = await fetch(COUPON_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Coupon endpoint returned ${response.status}`);
  return response.json();
}

function renderCheckResult(data) {
  if (!data.ok) {
    setRedeemEnabled(false);
    setResult(data.message || "쿠폰을 확인할 수 없습니다.", "is-error");
    return;
  }

  if (data.status === "ISSUED") {
    lastCheckedCode = data.code;
    setRedeemEnabled(true);
    setResult(`사용 가능: ${data.itemName || "무료 음료 1잔"} / 코드 ${data.code}`, "is-valid");
    return;
  }

  if (data.status === "USED") {
    setRedeemEnabled(false);
    setResult(`이미 사용완료된 쿠폰입니다. ${data.usedAt ? `사용일: ${data.usedAt}` : ""}`, "is-used");
    return;
  }

  setRedeemEnabled(false);
  setResult("발급되지 않았거나 사용할 수 없는 쿠폰입니다.", "is-error");
}

async function checkCoupon() {
  const validationError = validateBaseFields(false);
  if (validationError) {
    setRedeemEnabled(false);
    setResult(validationError, "is-error");
    return;
  }

  setRedeemEnabled(false);
  setResult("쿠폰을 조회하는 중입니다.");

  try {
    const data = await postCouponAction(getPayload("check"));
    renderCheckResult(data);
  } catch (error) {
    setResult("쿠폰 서버와 통신하지 못했습니다.", "is-error");
  }
}

async function redeemCoupon() {
  const validationError = validateBaseFields(true);
  if (validationError) {
    setResult(validationError, "is-error");
    return;
  }

  const payload = getPayload("redeem");
  if (payload.code !== lastCheckedCode) {
    setRedeemEnabled(false);
    setResult("조회한 코드와 현재 입력된 코드가 다릅니다. 다시 조회하세요.", "is-error");
    return;
  }

  setRedeemEnabled(false);
  setResult("사용완료 처리 중입니다.");

  try {
    const data = await postCouponAction(payload);
    if (data.ok && data.status === "USED") {
      setResult(`사용완료 처리되었습니다. 코드 ${data.code}`, "is-valid");
      return;
    }
    renderCheckResult(data);
  } catch (error) {
    setResult("사용완료 처리에 실패했습니다.", "is-error");
  }
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) elements.code.value = normalizeCode(code);

  const savedPin = window.sessionStorage.getItem("guyoStaffPin");
  const savedName = window.sessionStorage.getItem("guyoStaffName");
  const savedStore = window.sessionStorage.getItem("guyoStoreName");
  if (savedPin) elements.pin.value = savedPin;
  if (savedName) elements.staffName.value = savedName;
  if (savedStore) elements.storeName.value = savedStore;
}

function persistStaffFields() {
  window.sessionStorage.setItem("guyoStaffPin", elements.pin.value.trim());
  window.sessionStorage.setItem("guyoStaffName", elements.staffName.value.trim());
  window.sessionStorage.setItem("guyoStoreName", elements.storeName.value.trim());
}

elements.checkButton.addEventListener("click", () => {
  persistStaffFields();
  checkCoupon();
});
elements.redeemButton.addEventListener("click", () => {
  persistStaffFields();
  redeemCoupon();
});
elements.code.addEventListener("input", () => {
  lastCheckedCode = "";
  setRedeemEnabled(false);
});

hydrateFromUrl();
