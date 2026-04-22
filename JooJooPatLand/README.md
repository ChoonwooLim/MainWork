# JooJoo Land — 34필지 경계 지도

경기도 양평군 양동면 금왕리·고송리에 분포한 **34필지**의 지적 경계선을 한 페이지에서 확인하는 웹 지도.

- 총 면적: **517,180㎡** (약 156,442평 / 51.7ha)
- 대표 필지: 금왕리 산205 (임야, 471,672㎡)

## 주요 기능

- VWorld 위성/일반/OSM 베이스맵 전환
- 연속지적도 overlay 토글
- 34필지 폴리곤 렌더링 (지목별 색상)
- 지목·소유자별 필터
- 필지 클릭 시 상세 정보 팝업 (지번·지목·면적·소유자·PNU)
- 사이드바 필지 목록 → 클릭 시 해당 필지로 줌

## 실행 방법

### 1. VWorld API 키 발급 (1분)

1. https://www.vworld.kr/dev/v4api.do 접속 → 로그인
2. **"2D 지도 API"** 인증키 신청
3. 서비스 URL: `http://localhost:8000` (로컬 테스트용)
4. 발급받은 키 복사

### 2. `.env` 파일에 키 저장

```bash
# .env.example 복사 후 실제 키 입력
cp .env.example .env
# 편집기로 열어 VWORLD_API_KEY=... 에 발급받은 키 붙여넣기
```

`.env` 는 `.gitignore` 되어있어 커밋 안 됨.

### 3. 서버 실행

```bash
python serve.py          # 기본 포트 8000
python serve.py 9000     # 다른 포트
```

`serve.py` 가 하는 일:
- `.env` 읽어서 `config.js` 자동 생성 (브라우저가 `window.VWORLD_KEY` 로 사용)
- Cache-Control 헤더 포함 HTTP 서버 시작 (개발 중 F5 없이 새로고침)

### 4. 브라우저 접속

http://localhost:8000 — 키가 `.env` 에 있으면 바로 34필지 로드 시작.

**백업 경로**: `.env` 가 없거나 키가 비어있으면 브라우저 모달이 뜨고, 입력한 키는 `localStorage` 에 저장됨 (우상단 🔑 버튼으로 재설정).

## 파일 구조

```
JooJooPatLand/
├── index.html       # 메인 HTML (레이아웃 + 모달)
├── app.js           # 지도 로직 + VWorld API 호출
├── parcels.js       # 34필지 데이터
├── parcels.csv      # 동일 데이터 (사람이 읽기 쉬운 형식)
├── styles.css       # 스타일
├── serve.py         # .env → config.js 생성 + 로컬 HTTP 서버
├── .env.example     # 환경변수 템플릿 (커밋됨)
├── .env             # 실제 키 (gitignored)
├── config.js        # serve.py 가 .env 에서 생성 (gitignored)
└── README.md
```

## 데이터 출처

- 지번 목록: 원본 종이 문서 (2026-04-22 OCR)
- 경계선 데이터: [국토교통부 VWorld 오픈API](https://www.vworld.kr/) - LP_PA_CBND_BUBUN (연속지적도 부분코드)

## 필지 요약

| 소유자 | 필지 수 | 비고 |
|---|---:|---|
| 덕수이씨 (고당파) | 18 | 산205 포함 — 면적 절대다수 |
| 이세용 (서울) | 11 | |
| 이정용 (원주) | 3 | |
| 이재호 (원주) | 1 | |
| 이봉렬 (삼산리) | 1 | 493-1 |

## 알려진 이슈

- **도메인 불일치 에러**: VWorld 키 발급 시 입력한 서비스 URL과 실제 접속 URL이 다르면 "인증키 오류". 포트 번호까지 정확히 맞춰야 함.
- **산 지번 검색 정확도**: `산205`처럼 큰 임야는 geocode 반환 좌표가 중심점이라 주변 다른 필지와 겹쳐 보일 수 있음.
- **rate limit**: 동시 2개씩 순차 호출로 제한 (VWorld 무료 플랜).
