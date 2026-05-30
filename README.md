# ⬡ ShareLink — 실시간 화면 공유 서비스

WebRTC 기반 실시간 화면 공유 서비스입니다.
별도 프로그램 설치 없이 브라우저만으로 화면을 공유하고,
원격 마우스 제어, 마이크, 일시정지 등 다양한 기능을 사용할 수 있습니다.

---

## 📁 프로젝트 구조

```
screenshare/
├── render.yaml                  ← Render 배포 설정 (자동 인식)
├── .gitignore                   ← Git 제외 목록
├── README.md                    ← 이 파일
├── server/
│   ├── index.js                 ← Node.js 메인 서버
│   └── package.json             ← 서버 의존성
└── client/
    └── public/
        ├── index.html           ← 메인 페이지 (UI)
        ├── style.css            ← 스타일
        └── app.js               ← WebRTC + 소켓 로직
```

---

## ⚙️ 기술 스택

| 항목 | 기술 |
|------|------|
| 서버 | Node.js + Express |
| 실시간 통신 | Socket.io |
| 화면 공유 | WebRTC (getDisplayMedia) |
| STUN 서버 | Google STUN (무료) |
| 프론트엔드 | 순수 HTML/CSS/JS |
| 배포 | Render (또는 로컬) |

---

## 🎛️ 기능 목록

| 버튼 | 기능 설명 |
|------|-----------|
| ⬛ 공유 중지 | 화면 공유를 완전히 멈추고 컨트롤 바도 삭제 |
| 🎤 마이크 | 마이크 음성 송출 on/off 토글 |
| 🔄 창 바꾸기 | 현재 공유 중인 창을 다른 창으로 교체 |
| 🖱️ 원격 마우스 | 참여자가 호스트 화면에 마우스 커서를 올릴 수 있게 허용 |
| ⏸ 일시정지 | 화면을 프리즈 (연결은 유지, 화면만 멈춤) |
| 👥 참여자 | 현재 입장한 사람 목록 보기 |
| ✕ 숨기기 | 컨트롤 바만 숨김 (공유는 계속 유지) |

> 💡 컨트롤 바는 드래그해서 화면 어디든 옮길 수 있어요

---

## 🖥️ 로컬에서 실행하기

### 준비물
- **Node.js 18 이상** 설치 필요
  - https://nodejs.org 접속
  - **LTS** 버전 클릭해서 다운로드 후 설치
  - 설치 확인: 터미널에서 `node -v` 입력 → `v18.x.x` 같이 나오면 OK

### 실행 방법

**1. 터미널(명령 프롬프트) 열기**
- Windows: `Win + R` → `cmd` 입력 → 엔터
- Mac: `Cmd + Space` → `터미널` 검색

**2. server 폴더로 이동**
```bash
cd 다운받은경로/screenshare/server
```
예시 (Windows):
```bash
cd C:\Users\홍길동\Downloads\screenshare\server
```
예시 (Mac):
```bash
cd ~/Downloads/screenshare/server
```

**3. 패키지 설치**
```bash
npm install
```
→ `node_modules` 폴더가 생기면 성공

**4. 서버 실행**
```bash
npm start
```
→ 아래 메시지가 나오면 성공:
```
🚀 서버 실행 중: http://localhost:3000
📡 시그널링 서버 준비 완료
```

**5. 브라우저에서 접속**
- 크롬/엣지 열고 주소창에 입력: `http://localhost:3000`

**6. 서버 종료**
- 터미널에서 `Ctrl + C` 누르면 종료

### 개발 모드 (코드 수정 시 자동 재시작)
```bash
npm run dev
```

---

## 🌐 GitHub에 올리기

### 1. Git 설치 확인
```bash
git --version
```
→ 버전이 나오면 OK. 없으면 https://git-scm.com 에서 설치

### 2. GitHub 계정 만들기
- https://github.com 접속 → Sign up

### 3. 새 레포지토리 만들기
1. GitHub 우측 상단 **+** 버튼 → **New repository**
2. Repository name: `sharelink` (원하는 이름 가능)
3. **Public** 선택 (Render 무료 배포에 필요)
4. **Create repository** 클릭
5. 레포 주소 복사해두기 (예: `https://github.com/홍길동/sharelink.git`)

### 4. 로컬에서 Git 초기화 및 업로드

터미널에서 **screenshare 폴더**(server 상위)로 이동:
```bash
cd 다운받은경로/screenshare
```

아래 명령어를 순서대로 입력:
```bash
# Git 저장소 초기화
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "first commit"

# 브랜치 이름을 main으로 설정
git branch -M main

# GitHub 레포 연결 (주소는 위에서 복사한 것으로 교체)
git remote add origin https://github.com/홍길동/sharelink.git

# 업로드
git push -u origin main
```

→ GitHub 아이디/비밀번호(또는 토큰) 입력 요청이 올 수 있음

> ⚠️ **GitHub 비밀번호 대신 토큰 필요한 경우**
> 1. GitHub → 우측 상단 프로필 → Settings
> 2. 좌측 하단 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
> 3. **Generate new token** → `repo` 체크 → 생성
> 4. 생성된 토큰을 비밀번호 대신 입력

### 5. 업로드 확인
`https://github.com/홍길동/sharelink` 접속하면 파일들이 보여야 함

---

## 🚀 Render에 배포하기

### 1. Render 회원가입
1. https://render.com 접속
2. 우측 상단 **Get Started** 클릭
3. **GitHub으로 계속** 선택 (GitHub 연동이 제일 편함)
4. 권한 허용

### 2. 새 웹 서비스 만들기
1. 대시보드에서 **New +** 버튼 클릭
2. **Web Service** 선택
3. **Connect a repository** 화면에서 `sharelink` 레포 선택
   - 안 보이면 **Configure account** 클릭해서 레포 접근 허용
4. **Connect** 클릭

### 3. 배포 설정 입력

아래 항목들을 정확히 입력:

| 항목 | 입력값 |
|------|--------|
| Name | `sharelink` (자유) |
| Region | Singapore (한국에서 가장 빠름) |
| Branch | `main` |
| Root Directory | `server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

### 4. 배포 시작
- **Create Web Service** 클릭
- 배포 로그가 실시간으로 표시됨
- 아래 메시지가 나오면 성공:
  ```
  🚀 서버 실행 중: http://localhost:10000
  📡 시그널링 서버 준비 완료
  ```
- 상단에 `https://sharelink-xxxx.onrender.com` 형태의 주소 생성됨

### 5. 접속 확인
- 생성된 주소로 크롬에서 접속
- 화면이 뜨면 배포 완료!

### 6. 코드 수정 후 재배포
```bash
git add .
git commit -m "수정 내용"
git push
```
→ GitHub에 push하면 Render가 자동으로 재배포함

---

## ⚠️ Render 무료 플랜 주의사항

### 슬립 모드 문제
- **15분 동안 아무도 접속 안 하면** 서버가 잠들어요
- 다시 누가 접속하면 깨어나는데 **약 30~60초** 소요
- 처음 접속 시 로딩이 길면 기다리면 됨

### 슬립 방지 방법 (선택사항)
**UptimeRobot 사용** (무료):
1. https://uptimerobot.com 회원가입
2. **Add New Monitor** 클릭
3. Monitor Type: **HTTP(s)**
4. URL: Render 배포 주소 입력
5. Monitoring Interval: **5 minutes**
6. 저장 → 5분마다 자동으로 핑을 보내서 슬립 방지

### 무료 플랜 제한
- 월 750시간 무료 (하루 24시간 기준 약 31일 → 사실상 무제한)
- 대역폭 제한 있음 (소규모 팀 사용엔 충분)
- HTTPS 자동 적용됨 (WebRTC에 필수라서 중요!)

---

## 🔧 문제 해결

### `npm install` 오류가 날 때
```bash
# Node.js 버전 확인
node -v
```
→ 18 미만이면 https://nodejs.org 에서 최신 LTS 설치

### `git push` 할 때 인증 오류
→ GitHub Personal Access Token 발급 필요 (위 GitHub 섹션 참고)

### Render에서 빌드 실패
- **Root Directory**가 `server`로 정확히 설정됐는지 확인
- 빌드 로그에서 빨간 줄 찾아서 오류 내용 확인

### 화면 공유가 안 될 때
- **반드시 HTTPS** 환경에서만 작동 (Render는 자동 HTTPS 적용)
- localhost는 예외적으로 HTTP도 됨
- 크롬/엣지 권장 (파이어폭스도 됨, 사파리 일부 제한)

### 두 사람이 연결이 안 될 때
- 같은 와이파이면 대부분 됨
- 서로 다른 네트워크(LTE vs 집 와이파이)면 TURN 서버 필요
  - 해결책: Twilio STUN/TURN 서비스 (월 소량 유료) 또는 coturn 직접 구축

---

## 🖱️ 원격 마우스 제어 안내

### 현재 구현 방식
참여자의 마우스 커서가 **호스트 화면에 보라색 커서로 오버레이** 표시됩니다.
어디를 가리키는지 볼 수 있지만, 실제로 클릭이 되진 않아요.

### 왜 실제 클릭이 안 되나요?
브라우저 보안 정책상 다른 사람의 컴퓨터 마우스를 직접 제어하는 건 불가능해요.
이건 TeamViewer나 AnyDesk 같은 전용 프로그램도 OS 레벨 에이전트를 별도로 설치해서 우회하는 방식이에요.

### 진짜 마우스 제어가 필요하다면?
- **Electron 앱**으로 변환 + `robotjs` 라이브러리 사용
- 또는 기존 솔루션 활용: AnyDesk, TeamViewer, Chrome 원격 데스크톱

---

## 📞 사용 방법 요약

### 호스트 (화면 공유하는 사람)
1. 사이트 접속 → 닉네임 입력
2. **방 만들기** 클릭
3. **화면 공유 시작** → 공유할 창 선택
4. 생성된 **8자리 방 코드**를 친구에게 카톡/문자로 공유
5. 컨트롤 바로 기능 조작

### 참여자 (화면 보는 사람)
1. 사이트 접속 → 닉네임 입력
2. 받은 방 코드 입력 → **입장**
3. 자동으로 화면 공유 화면 표시
