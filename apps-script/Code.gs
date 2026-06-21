const COUPON_LIMIT = 100;
const COUPON_ITEM_NAME = "무료 음료 1잔";
const DEFAULT_COUPON_BASE_URL = "https://guyoevent.lonhats.com/coupon.html";

const SHEETS = {
  leads: "Leads",
  coupons: "Coupons",
  redemptions: "Redemptions",
};

const HEADERS = {
  leads: [
    "createdAt",
    "leadId",
    "name",
    "phone",
    "rawPhone",
    "outcome",
    "couponEligible",
    "couponCode",
    "couponUrl",
    "pageUrl",
    "campaign",
    "payloadJson",
  ],
  coupons: [
    "code",
    "itemName",
    "status",
    "issuedToLeadId",
    "name",
    "phone",
    "issuedAt",
    "usedAt",
    "usedBy",
    "storeName",
    "memo",
    "couponUrl",
  ],
  redemptions: ["createdAt", "code", "result", "statusBefore", "usedBy", "storeName", "memo"],
};

const STATUS = {
  available: "AVAILABLE",
  issued: "ISSUED",
  used: "USED",
};

function setupGuyoCouponSystem() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, SHEETS.leads, HEADERS.leads);
  const couponsSheet = ensureSheet_(ss, SHEETS.coupons, HEADERS.coupons);
  ensureSheet_(ss, SHEETS.redemptions, HEADERS.redemptions);
  ensureCoupons_(couponsSheet);
}

function doGet(e) {
  try {
    const action = String((e.parameter && e.parameter.action) || "stats");
    if (action === "coupon") return json_(getPublicCoupon_(e.parameter));
    return json_(getStats_());
  } catch (error) {
    return json_({ ok: false, message: error.message || "요청 처리에 실패했습니다." });
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || "lead");
    if (action === "lead") return json_(handleLead_(payload));
    if (action === "check") return json_(checkCoupon_(payload));
    if (action === "redeem") return json_(redeemCoupon_(payload));
    return json_({ ok: false, message: "지원하지 않는 요청입니다." });
  } catch (error) {
    return json_({ ok: false, message: error.message || "요청 처리에 실패했습니다." });
  }
}

function handleLead_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const leadsSheet = ensureSheet_(ss, SHEETS.leads, HEADERS.leads);
    const couponsSheet = ensureSheet_(ss, SHEETS.coupons, HEADERS.coupons);
    ensureSheet_(ss, SHEETS.redemptions, HEADERS.redemptions);
    ensureCoupons_(couponsSheet);

    const now = new Date();
    const leadId = String(payload.leadId || makeLeadId_());
    const name = String(payload.name || "").trim();
    const phone = normalizePhone_(payload.phone || payload.rawPhone || "");
    if (name.length < 2) throw new Error("이름을 확인해 주세요.");
    if (phone.length < 10 || phone.length > 11) throw new Error("연락처를 확인해 주세요.");

    const existing = findCouponByPhone_(couponsSheet, phone);
    const assigned = existing || assignCoupon_(couponsSheet, {
      leadId,
      name,
      phone,
      issuedAt: now,
      couponBaseUrl: payload.couponPageUrl || DEFAULT_COUPON_BASE_URL,
    });

    appendLead_(leadsSheet, payload, {
      createdAt: now,
      leadId,
      name,
      phone,
      coupon: assigned,
    });

    const stats = getStats_();
    return {
      ok: true,
      total: stats.total,
      participantCount: stats.total,
      couponIssued: stats.couponIssued,
      couponEligible: Boolean(assigned),
      couponCode: assigned ? assigned.code : "",
      couponUrl: assigned ? assigned.couponUrl : "",
      itemName: assigned ? assigned.itemName : COUPON_ITEM_NAME,
      smsQueued: false,
      manualSendRequired: Boolean(assigned),
      couponLimit: COUPON_LIMIT,
    };
  } finally {
    lock.releaseLock();
  }
}

function getPublicCoupon_(params) {
  const code = normalizeCode_(params.code || "");
  if (!code) return { ok: false, message: "쿠폰 코드가 없습니다." };

  const sheet = ensureSheet_(getSpreadsheet_(), SHEETS.coupons, HEADERS.coupons);
  const row = findCouponRowByCode_(sheet, code);
  if (!row) return { ok: false, code, message: "쿠폰을 찾을 수 없습니다." };

  return {
    ok: true,
    code,
    itemName: row.data.itemName || COUPON_ITEM_NAME,
    status: row.data.status,
    issuedAt: formatDate_(row.data.issuedAt),
    usedAt: formatDate_(row.data.usedAt),
  };
}

function checkCoupon_(payload) {
  verifyStaffPin_(payload.pin);
  const code = normalizeCode_(payload.code || "");
  if (!code) return { ok: false, message: "쿠폰 코드를 입력하세요." };

  const sheet = ensureSheet_(getSpreadsheet_(), SHEETS.coupons, HEADERS.coupons);
  const row = findCouponRowByCode_(sheet, code);
  if (!row) return { ok: false, code, message: "쿠폰을 찾을 수 없습니다." };

  return {
    ok: true,
    code,
    itemName: row.data.itemName || COUPON_ITEM_NAME,
    status: row.data.status,
    issuedAt: formatDate_(row.data.issuedAt),
    usedAt: formatDate_(row.data.usedAt),
  };
}

function redeemCoupon_(payload) {
  verifyStaffPin_(payload.pin);

  const code = normalizeCode_(payload.code || "");
  const staffName = String(payload.staffName || "").trim();
  const storeName = String(payload.storeName || "").trim();
  if (!code) return { ok: false, message: "쿠폰 코드를 입력하세요." };
  if (staffName.length < 2) return { ok: false, message: "직원명을 입력하세요." };
  if (storeName.length < 2) return { ok: false, message: "지점/매장을 입력하세요." };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const couponsSheet = ensureSheet_(ss, SHEETS.coupons, HEADERS.coupons);
    const redemptionsSheet = ensureSheet_(ss, SHEETS.redemptions, HEADERS.redemptions);
    const row = findCouponRowByCode_(couponsSheet, code);
    if (!row) return { ok: false, code, message: "쿠폰을 찾을 수 없습니다." };

    const statusBefore = row.data.status;
    if (statusBefore === STATUS.used) {
      appendRedemption_(redemptionsSheet, code, "ALREADY_USED", statusBefore, staffName, storeName, "");
      return {
        ok: false,
        code,
        status: STATUS.used,
        usedAt: formatDate_(row.data.usedAt),
        message: "이미 사용완료된 쿠폰입니다.",
      };
    }

    if (statusBefore !== STATUS.issued) {
      appendRedemption_(redemptionsSheet, code, "NOT_ISSUED", statusBefore, staffName, storeName, "");
      return { ok: false, code, status: statusBefore, message: "발급되지 않은 쿠폰입니다." };
    }

    const now = new Date();
    const index = row.index;
    couponsSheet.getRange(row.rowNumber, index.status + 1).setValue(STATUS.used);
    couponsSheet.getRange(row.rowNumber, index.usedAt + 1).setValue(now);
    couponsSheet.getRange(row.rowNumber, index.usedBy + 1).setValue(staffName);
    couponsSheet.getRange(row.rowNumber, index.storeName + 1).setValue(storeName);
    couponsSheet.getRange(row.rowNumber, index.memo + 1).setValue("직원 확인 후 사용완료");
    appendRedemption_(redemptionsSheet, code, "USED", statusBefore, staffName, storeName, "직원 확인 후 사용완료");

    return {
      ok: true,
      code,
      status: STATUS.used,
      usedAt: formatDate_(now),
      message: "사용완료 처리되었습니다.",
    };
  } finally {
    lock.releaseLock();
  }
}

function getStats_() {
  const ss = getSpreadsheet_();
  const leadsSheet = ensureSheet_(ss, SHEETS.leads, HEADERS.leads);
  const couponsSheet = ensureSheet_(ss, SHEETS.coupons, HEADERS.coupons);
  const total = Math.max(0, leadsSheet.getLastRow() - 1);
  const rows = getRows_(couponsSheet);
  const couponIssued = rows.values.filter((row) => {
    const status = row[rows.index.status];
    return status === STATUS.issued || status === STATUS.used;
  }).length;
  return { ok: true, total, participantCount: total, couponIssued, couponLimit: COUPON_LIMIT };
}

function appendLead_(sheet, payload, record) {
  const coupon = record.coupon;
  sheet.appendRow([
    record.createdAt,
    record.leadId,
    record.name,
    record.phone,
    payload.rawPhone || "",
    payload.outcome || "",
    Boolean(coupon),
    coupon ? coupon.code : "",
    coupon ? coupon.couponUrl : "",
    payload.pageUrl || "",
    payload.campaign || "",
    JSON.stringify(payload),
  ]);
}

function appendRedemption_(sheet, code, result, statusBefore, staffName, storeName, memo) {
  sheet.appendRow([new Date(), code, result, statusBefore, staffName, storeName, memo]);
}

function assignCoupon_(sheet, lead) {
  const rows = getRows_(sheet);
  for (let i = 0; i < rows.values.length; i += 1) {
    const row = rows.values[i];
    if (row[rows.index.status] !== STATUS.available) continue;

    const rowNumber = i + 2;
    const code = row[rows.index.code];
    const couponUrl = buildCouponUrl_(lead.couponBaseUrl, code);
    sheet.getRange(rowNumber, rows.index.status + 1).setValue(STATUS.issued);
    sheet.getRange(rowNumber, rows.index.issuedToLeadId + 1).setValue(lead.leadId);
    sheet.getRange(rowNumber, rows.index.name + 1).setValue(lead.name);
    sheet.getRange(rowNumber, rows.index.phone + 1).setValue(lead.phone);
    sheet.getRange(rowNumber, rows.index.issuedAt + 1).setValue(lead.issuedAt);
    sheet.getRange(rowNumber, rows.index.couponUrl + 1).setValue(couponUrl);

    return { code, itemName: row[rows.index.itemName] || COUPON_ITEM_NAME, couponUrl };
  }
  return null;
}

function findCouponByPhone_(sheet, phone) {
  const rows = getRows_(sheet);
  for (let i = 0; i < rows.values.length; i += 1) {
    const row = rows.values[i];
    const status = row[rows.index.status];
    if (row[rows.index.phone] === phone && (status === STATUS.issued || status === STATUS.used)) {
      return {
        code: row[rows.index.code],
        itemName: row[rows.index.itemName] || COUPON_ITEM_NAME,
        couponUrl: row[rows.index.couponUrl],
      };
    }
  }
  return null;
}

function findCouponRowByCode_(sheet, code) {
  const rows = getRows_(sheet);
  for (let i = 0; i < rows.values.length; i += 1) {
    const row = rows.values[i];
    if (normalizeCode_(row[rows.index.code]) === code) {
      const data = {};
      rows.headers.forEach((header, headerIndex) => {
        data[header] = row[headerIndex];
      });
      return { rowNumber: i + 2, data, index: rows.index };
    }
  }
  return null;
}

function ensureCoupons_(sheet) {
  const rows = getRows_(sheet);
  const existingCodes = {};
  rows.values.forEach((row) => {
    existingCodes[normalizeCode_(row[rows.index.code])] = true;
  });

  let needed = COUPON_LIMIT - rows.values.length;
  while (needed > 0) {
    const code = makeCouponCode_();
    if (existingCodes[code]) continue;
    existingCodes[code] = true;
    sheet.appendRow([code, COUPON_ITEM_NAME, STATUS.available, "", "", "", "", "", "", "", "", ""]);
    needed -= 1;
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  headers.forEach((header, index) => {
    if (currentHeaders[index] !== header) sheet.getRange(1, index + 1).setValue(header);
  });
  return sheet;
}

function getRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const index = {};
  headers.forEach((header, i) => {
    if (header) index[header] = i;
  });
  return { headers, index, values: values.slice(1) };
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error("SPREADSHEET_ID 스크립트 속성을 설정하거나 Google Sheet에 바인딩된 Apps Script로 실행하세요.");
}

function verifyStaffPin_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty("STAFF_PIN");
  if (!expected) throw new Error("STAFF_PIN 스크립트 속성을 먼저 설정하세요.");
  if (String(pin || "") !== String(expected)) throw new Error("직원 PIN이 올바르지 않습니다.");
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function normalizePhone_(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function normalizeCode_(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function makeCouponCode_() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GUYO-";
  for (let i = 0; i < 8; i += 1) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function makeLeadId_() {
  return `LEAD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function buildCouponUrl_(baseUrl, code) {
  const separator = String(baseUrl).indexOf("?") >= 0 ? "&" : "?";
  return `${baseUrl}${separator}code=${encodeURIComponent(code)}`;
}

function formatDate_(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
