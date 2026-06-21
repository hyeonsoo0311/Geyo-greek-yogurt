# 오늘도 출근 완료

음료를 제공해 평범한 한국인 직장인의 HP를 관리하고 30초 동안 퇴근까지 버티는 반응형 픽셀 아트 웹 게임입니다.

## 실행

```powershell
npm run dev
```

브라우저에서 `http://localhost:4173`을 엽니다.

GitHub Pages 배포는 `main` 브랜치에 푸시하면 자동으로 실행됩니다.

## 조작

- 캐릭터 선택 후 즉시 시작
- 게임 중 `캐릭터 변경`으로 다시 선택
- 음료 카드 클릭 또는 키보드 `1`~`4`
- 스페이스바: 일시정지 / 계속하기
- 모든 음료: HP +20
- GEGA COFFEE와 RED BEAR 합산 5잔: 구급차 응급실 엔딩
- 그요 레몬쥬스와 그요 BOSS TEA 합산 5잔: 건강한 퇴근 엔딩
- 카페인 1000mg 이상: 구급차 응급실 엔딩
- 그요 레몬쥬스 3잔: 밝은 표정
- 그요 BOSS TEA 3병: Relax 표정

## 기프티콘 운영

- 고객용 쿠폰 화면: `https://guyoevent.lonhats.com/coupon.html?code=쿠폰코드`
- 직원용 사용 처리 화면: `https://guyoevent.lonhats.com/staff.html`
- 쿠폰 항목: 무료 음료 1잔
- 쿠폰 상태: `AVAILABLE` → `ISSUED` → `USED`
- `Leads` 시트가 실제 기프티콘 신청자/참가자 명단입니다.
- 이름 중복은 허용하고, 같은 연락처는 한 번만 신청할 수 있습니다.

### Apps Script 설정

1. `apps-script/Code.gs` 내용을 Apps Script `Code.gs`에 붙여넣습니다.
2. 스크립트 속성에 `STAFF_PIN`을 설정합니다.
3. 독립 실행형 Apps Script라면 스크립트 속성에 `SPREADSHEET_ID`도 설정합니다.
4. `setupGuyoCouponSystem()`을 1회 실행해 `Leads`, `Coupons`, `Redemptions` 시트와 쿠폰 100개를 생성합니다.
5. 웹앱으로 다시 배포합니다.

직원이 고객 쿠폰 코드를 조회한 뒤 `사용완료 처리`를 누르면 해당 쿠폰은 `USED` 상태가 되어 재사용할 수 없습니다.
