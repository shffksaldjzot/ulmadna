# 배너 자동 제작 글꼴 (2026년 11월 24일)

서버가 광고 배너를 그릴 때만 읽는 글꼴이다(`src/server/banner/bannerFonts.ts`). 브라우저로 내려보내지 않는다(`public/` 에 두지 않음).
`scripts/sponsor-banners/build-banner-fonts.py` 가 PC 에 깔린 원본에서 굵기 하나씩 뽑고, 쓰는 글자만 남겨(부분집합) 만든다.
허가문 전문은 같은 폴더 `OFL.txt`.

| 파일 | 원본(만든 PC 의 파일) | 원본 버전(글꼴 이름표 5번) | 허가(글꼴 이름표 13·14번) | 남긴 한글 |
|---|---|---|---|---|
| NotoSansKR-400/700/800/900.ttf | `C:/Windows/Fonts/NotoSansKR-VF.ttf`(가변 글꼴에서 굵기 고정) | Version 2.04 | SIL OFL 1.1 · 예약 이름 'Source' | 11,172자 |
| NotoSerifKR-400/700.ttf | `C:/Windows/Fonts/NotoSerifKR-VF.ttf`(가변 글꼴에서 굵기 고정) | Version 2.02 | SIL OFL 1.1 | 완성형 2,350자 |
| BlackHanSans-400.ttf | 사용자 글꼴 폴더 `BlackHanSans-Regular.ttf` | Version 1.00 | SIL OFL 1.1 | 원본에 있는 것(완성형 범위) |
| GmarketSans-700.ttf | 사용자 글꼴 폴더 `GmarketSansTTFBold.ttf` | Version 1.000 | SIL OFL 1.1 · 예약 이름 'Gmarket Sans Font' | 11,172자 |
| Pretendard-300/900.otf | 사용자 글꼴 폴더 `Pretendard-Light.otf`·`Pretendard-Black.otf` | Version 1.309 | SIL OFL 1.1 | 11,172자 |

- 원본을 내려받은 곳: Noto = Google Fonts(구글 노토), 검은고딕 = Google Fonts(ZESSTYPE), G마켓 산스 = 지마켓 글꼴 안내 페이지(글꼴 이름표 14번 `www.gmarket.co.kr/corp/gmarketsans`), Pretendard = orioncactus/pretendard 저장소. PC 에 깔린 시점의 정확한 내려받기 기록은 없다(파일 날짜: 노토 2025-04, 검은고딕 2018-02, G마켓 2024-12, Pretendard 2023-11).
- **G마켓 산스 허가 근거**: 원본 글꼴 파일 안의 허가문(이름표 13번, 저작권자 eBay Korea 가 넣은 것)에 "This Font Software is licensed under the SIL Open Font License, Version 1.1", 예약 이름 "Gmarket Sans Font" 로 적혀 있다. 웹 페이지 원문은 따로 열어 보지 않았다.
- **예약 이름**: OFL 은 바꾼 판에 예약 이름을 못 쓰게 하므로, 부분집합 파일의 글꼴 이름(이름표 1·4·6 등)을 `UlmBanner Gothic 400` 같은 이름으로 바꿨다. 저작권 줄·허가 줄은 그대로 남겼다.
- 글자 폭 표 `metrics.json` 도 같은 스크립트가 만든다. 서버는 이 표에 있는 글자만 그린다(없는 글자는 지우고 미리 보기에서 알린다).
