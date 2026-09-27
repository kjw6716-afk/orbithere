# 뉴스 이미지 출처

확인일: 2026-09-27

`data/news-images.json`은 `data/news.json`의 정확한 기사 ID에 연결하는 별도 편집 자료입니다. `sourceUrl`은 해당 기사의 URL과 동일하고, `licenseUrl`은 아래에 확인한 NASA 이용 안내 또는 Creative Commons 라이선스의 정확한 주소입니다. 화면의 ‘이용 조건’ 링크로 해당 조건을 바로 확인할 수 있습니다. 수집기는 이 파일을 생성하거나 덮어쓰지 않습니다. 새 기사에 확인된 매핑이 없으면 텍스트 목록을 유지합니다.

공식 기사와 개별 이미지 페이지에서 주제·크레딧·이용 조건을 확인한 7장만 사용합니다. 사진·관측 영상은 `photo`, 데이터 시각화·탐사선 렌더링·공식 일러스트는 `visualization`으로 구분하고 한국어 대체 텍스트에 실제 성격을 설명합니다. 생성형 뉴스 사진과 무관한 대체 사진은 없습니다.

## 이용 근거와 처리

- NASA의 [이미지·미디어 이용 안내](https://www.nasa.gov/nasa-brand-center/images-and-media/)에 따른 정보·보도 목적 사용입니다. 선택한 두 이미지에는 NASA Scientific Visualization Studio 크레딧이 있으며 제3자 저작권 표시는 없습니다. NASA의 승인·보증이나 실물 사진으로 소개하지 않습니다.
- ESA 자료는 개별 이미지 페이지가 명시한 Creative Commons 라이선스를 선택합니다. CC BY 4.0 또는 CC BY-SA 3.0 IGO를 이미지별로 표시하며 원문 크레딧을 유지합니다. BY-SA 이미지의 기술적 변환본에도 동일 라이선스를 유지합니다. [ESA 이용 안내](https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website).
- 원본 비율과 전체 화면을 보존하여 최대 변 640px로 축소하고 Pillow의 LANCZOS, WebP quality 85 / method 6으로 형식·크기만 최적화했습니다. 자르기·합성·보정·문자 삽입은 하지 않았습니다. 아래 직접 이미지 URL은 실제 내려받은 원본입니다.
- 이미지 7개의 전체 전송 크기는 **231,074 bytes**입니다. 목록에서는 필요한 이미지부터 지연 로딩하며 개별 이미지 크레딧과 기사 링크를 표시합니다.

## 이미지별 기록

### bepicolombo-mercury-welcome.webp

- 기사 ID: `c90de238e618819e`
- [공식 기사](https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/Win_a_trip_to_ESA_to_witness_BepiColombo_arrive_at_Mercury) · [이미지 설명·크레딧](https://www.esa.int/ESA_Multimedia/Images/2026/09/Welcome_BepiColombo_to_Mercury) · [다운로드 원본](https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2026/09/welcome_bepicolombo_to_mercury/27520540-1-eng-GB/Welcome_BepiColombo_to_Mercury_pillars.png)
- 크레딧: ESA · Acknowledgements: Design & Data GmbH · CC BY-SA 3.0 IGO
- 라이선스: [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/)
- 성격: `visualization`. 기사의 Open Graph 대표 이미지와 동일한 ‘Welcome to Mercury’ 행사 일러스트. 개별 갤러리 ID 528692에서 ESA 크레딧, 제작사 표시와 CC BY-SA 3.0 IGO 선택 가능 표시를 직접 확인했다. 탐사선 실물 사진이 아닌 Bepi·Mio 캐릭터 그림으로 설명한다.
- 변환: 1920 × 1080 → 640 × 360, 31,838 bytes. 로컬 파일: `images/news/bepicolombo-mercury-welcome.webp`.
- 원본 SHA-256: `7fc9b8e1370a712ccc3a80300c2ed0359b2ac653edd0edb6228cf6b35d2450e4`

### nisar-kamchatka-volcano.webp

- 기사 ID: `0040b4ad2fba9cc6`
- [공식 기사](https://www.nasa.gov/missions/nisar/us-india-satellite-captures-time-lapse-video-of-volcanic-eruption/) · [이미지 설명·크레딧](https://www.nasa.gov/missions/nisar/us-india-satellite-captures-time-lapse-video-of-volcanic-eruption/) · [다운로드 원본](https://www.nasa.gov/wp-content/uploads/2026/09/nisar-kamchatka-still-volcano.jpg)
- 크레딧: NASA’s Scientific Visualization Studio
- 라이선스: [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
- 성격: `visualization`. 기사 대표 이미지와 본문 영상 설명의 NASA SVS 크레딧 확인. 광학 사진이 아닌 실제 레이더 관측 기반 3D 시각화의 공식 스틸 이미지.
- 변환: 1764 × 992 → 640 × 360, 96,894 bytes. 로컬 파일: `images/news/nisar-kamchatka-volcano.webp`.
- 원본 SHA-256: `06b5ef9f05800a0f1334a2439e6013cfa7336f38c0aeaffdd1a606c6e26b14a7`

### juice-earth-flyby.webp

- 기사 ID: `89cffd08a80b28f1`
- [공식 기사](https://www.esa.int/Science_Exploration/Space_Science/Juice/Juice_to_fly_past_Earth_for_third_gravity_assist) · [이미지 설명·크레딧](https://www.esa.int/ESA_Multimedia/Images/2026/09/Juice_flies_past_Earth) · [다운로드 원본](https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2026/09/juice_flies_past_earth/27532450-1-eng-GB/Juice_flies_past_Earth_pillars.png)
- 크레딧: © European Space Agency · CC BY-SA 3.0 IGO
- 라이선스: [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/)
- 성격: `visualization`. 기사 대표 이미지와 동일한 미디어. 원문은 realistic-looking render로 명시하며 실제 근접비행 사진이 아니다.
- 변환: 2511 × 1080 → 640 × 275, 5,116 bytes. 로컬 파일: `images/news/juice-earth-flyby.webp`.
- 원본 SHA-256: `97f21baeb1af16c8073ab46aa218b2d96dd563e0557032efe9a531ccc9534923`

### hubble-ngc-4698.webp

- 기사 ID: `a7121263bf60a3eb`
- [공식 기사](https://www.esa.int/ESA_Multimedia/Images/2026/09/A_galaxy_spinning_out_of_sync) · [이미지 설명·크레딧](https://www.esa.int/ESA_Multimedia/Images/2026/09/A_galaxy_spinning_out_of_sync) · [다운로드 원본](https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2026/09/a_galaxy_spinning_out_of_sync/27523332-1-eng-GB/A_galaxy_spinning_out_of_sync_pillars.jpg)
- 크레딧: ESA/Hubble & NASA, D. Thilker, the MAUVE-HST Team · CC BY 4.0
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 성격: `photo`. 기사 자체가 허블 관측 이미지 공개 페이지이며 이미지 설명, 전체 크레딧과 CC BY 4.0 선택 가능 표시 확인.
- 변환: 1920 × 1949 → 630 × 640, 17,112 bytes. 로컬 파일: `images/news/hubble-ngc-4698.webp`.
- 원본 SHA-256: `f5b11ceab519782fbd85a6d75b600cdc6c8c85266efcab4287a00dd236334cc2`

### earth-center-of-mass.webp

- 기사 ID: `99f40581eed35fd5`
- [공식 기사](https://www.nasa.gov/science-research/earth-science/nasa-watches-earths-weight-finds-center-of-mass/) · [이미지 설명·크레딧](https://www.nasa.gov/science-research/earth-science/nasa-watches-earths-weight-finds-center-of-mass/) · [다운로드 원본](https://www.nasa.gov/wp-content/uploads/2026/09/1-earth-illustration-cropped.jpeg)
- 크레딧: NASA’s Scientific Visualization Studio
- 라이선스: [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
- 성격: `visualization`. 기사 첫 이미지의 설명과 NASA SVS 크레딧 확인. 실제 절개 사진이 아닌 3D 설명 이미지.
- 변환: 2935 × 1603 → 640 × 350, 10,970 bytes. 로컬 파일: `images/news/earth-center-of-mass.webp`.
- 원본 SHA-256: `fd10bb674f48f7425ed8fe40e8237da62923681f1e78b471d28a499829b0b02d`

### mars-thyles-rupes.webp

- 기사 ID: `58b1e077a564609b`
- [공식 기사](https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Purple_swirls_on_the_Red_Planet) · [이미지 설명·크레딧](https://www.esa.int/ESA_Multimedia/Images/2026/09/Raspberry_ripples_near_Mars_s_south_pole) · [다운로드 원본](https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2026/09/raspberry_ripples_near_mars_s_south_pole/27522585-1-eng-GB/Raspberry_ripples_near_Mars_s_south_pole_pillars.jpg)
- 크레딧: © ESA/DLR/FU Berlin · CC BY-SA 3.0 IGO
- 라이선스: [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/)
- 성격: `photo`. 기사에 연결된 HRSC 관측 영상 페이지. 원문상 nadir·colour 채널로 만든 영상이며 관측일 2026-02-17. 크레딧과 CC 라이선스 확인.
- 변환: 2153 × 1080 → 640 × 321, 22,656 bytes. 로컬 파일: `images/news/mars-thyles-rupes.webp`.
- 원본 SHA-256: `a0ccfb40751fda3524d7001cc9dea0dd9b208e079bb2fd9be6db94938200c528`

### webb-ic-348.webp

- 기사 ID: `3df2eabd436d73bc`
- [공식 기사](https://www.esa.int/Science_Exploration/Space_Science/Webb/Webb_reveals_stunning_panorama_of_star_formation) · [이미지 설명·크레딧](https://www.esa.int/ESA_Multimedia/Images/2026/09/Star-forming_region_IC_348_NIRCam_image) · [다운로드 원본](https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2026/09/star-forming_region_ic_348_nircam_image/27515180-1-eng-GB/Star-forming_region_IC_348_NIRCam_image_pillars.jpg)
- 크레딧: ESA/Webb, NASA, CSA, K. Luhman, C. Alves De Oliveira, M. Zamani (ESA/Webb) · CC BY 4.0
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 성격: `photo`. 기사 연결 이미지와 크레딧·CC BY 4.0 확인. 근적외선 관측을 사람이 볼 수 있게 표현한 영상이며 맨눈 색의 사진으로 설명하지 않는다.
- 변환: 1920 × 2376 → 517 × 640, 46,488 bytes. 로컬 파일: `images/news/webb-ic-348.webp`.
- 원본 SHA-256: `62f17c52fb0f7d0e7345a1d61c460480112a7d42c55a80d39559f21d03fc863f`

## 이번에 제외한 항목

- KASI의 ‘한가위 보름달’ 기사 이미지에는 **©최상주**라는 개인 사진가의 저작권 표시가 있습니다. 별도 재사용 근거가 확인되지 않아 사용하지 않았습니다.
- NASA PRIMA 선정 기사의 대표 이미지는 NASA 휘장입니다. 망원경의 실제 모습처럼 오인할 수 있는 임의 이미지를 붙이지 않고 텍스트로 유지합니다.
- Rocket Lab Electron 97번째 발사는 [해당 공식 사진](https://www.flickr.com/photos/rocketlab/55551275183/)까지 확인했지만 개별 사진에는 All rights reserved가 표시됩니다. [공식 계정 소개](https://www.flickr.com/people/rocketlab/)는 다운로드와 출처 표시를 안내하며, [별도 미디어 안내](https://rocketlabcorp.com/updates/link-to-rocket-lab-imagery-and-video/)는 비상업적 보도 재게시를 허용합니다. 다만 후자의 연결 대상은 과거 ‘It's a Test’ 사진 폴더여서 최신 Flickr 사진에도 해당 허용이 적용된다고 단정하지 않고 이번 묶음에서는 제외했습니다.
- 다른 기업 기사 사진은 이번 묶음에서 재사용 조건을 검증하지 않아 추가하지 않았습니다.

## 갱신 방법

새 이미지를 넣을 때 해당 기사와 이미지 설명을 직접 읽고 주제 일치·크레딧·라이선스를 확인합니다. 공식 이미지라도 제3자 권리 표시가 있으면 사용 근거를 별도로 확인합니다. `sourceUrl`은 피드 기사 URL과 정확히 맞추고, 실제 사진과 시각화를 구분합니다. 파일 존재·WebP 디코딩·현재 기사 ID 연결을 확인하고 새 기록을 이 문서에 추가합니다.
