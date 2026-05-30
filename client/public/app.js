/* ═══════════════════════════════════════════════════
   ShareLink — Client App
   Features: WebRTC screen share, remote mouse control,
             mic toggle, pause, participants panel,
             draggable control bar
═══════════════════════════════════════════════════ */

const socket = io();

// ── State ─────────────────────────────────────────
const state = {
  roomId: null,
  isHost: false,
  nickname: '',
  stream: null,
  audioStream: null,
  micEnabled: true,
  paused: false,
  barVisible: true,
  remoteMouse: false,
  peers: {}, // viewerId → RTCPeerConnection
  participants: []
};

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ── DOM refs ──────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = {
  home: $('home-screen'),
  host: $('host-screen'),
  viewer: $('viewer-screen')
};

// ═══════════════════════════════════════════════════
// SCREEN SWITCHING
// ═══════════════════════════════════════════════════
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ═══════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast${type ? ' ' + type : ''}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ═══════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════
$('create-room-btn').addEventListener('click', async () => {
  const nickname = $('nickname-input').value.trim() || '호스트';
  state.nickname = nickname;
  state.isHost = true;

  try {
    const res = await fetch('/api/room', { method: 'POST' });
    const { roomId } = await res.json();
    state.roomId = roomId;

    socket.emit('join-room', { roomId, isHost: true, nickname });
    setupHostScreen(roomId);
    showScreen('host');
    toast('방이 생성됐어요!', 'success');
  } catch (e) {
    toast('방 생성 실패', 'error');
  }
});

$('join-room-btn').addEventListener('click', joinRoom);
$('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

async function joinRoom() {
  const roomId = $('room-code-input').value.trim().toUpperCase();
  const nickname = $('nickname-input').value.trim() || '게스트';
  if (!roomId) { toast('방 코드를 입력하세요', 'error'); return; }

  try {
    const res = await fetch(`/api/room/${roomId}`);
    if (!res.ok) { toast('존재하지 않는 방이에요', 'error'); return; }

    state.roomId = roomId;
    state.nickname = nickname;
    state.isHost = false;

    socket.emit('join-room', { roomId, isHost: false, nickname });
    setupViewerScreen(roomId);
    showScreen('viewer');
  } catch (e) {
    toast('입장 실패', 'error');
  }
}

// ═══════════════════════════════════════════════════
// HOST SCREEN SETUP
// ═══════════════════════════════════════════════════
function setupHostScreen(roomId) {
  $('room-code-display').textContent = roomId;
  $('room-badge').style.display = '';
}

// 화면 공유 시작
$('start-share-btn').addEventListener('click', startScreenShare);

async function startScreenShare() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true
    });

    // 마이크 추가
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.audioStream = mic;
      mic.getTracks().forEach(t => stream.addTrack(t));
    } catch (_) {
      // 마이크 없어도 계속
    }

    state.stream = stream;

    const video = $('local-video');
    video.srcObject = stream;
    video.style.display = 'block';
    $('share-placeholder').style.display = 'none';

    toast('화면 공유 시작!', 'success');

    // 이미 연결된 뷰어에게 offer 전송
    Object.keys(state.peers).forEach(viewerId => {
      createOfferTo(viewerId);
    });

    // 스트림 종료 감지
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      stopShare();
    });
  } catch (e) {
    toast('화면 공유 권한이 거부됐어요', 'error');
  }
}

// 창 바꾸기
async function switchScreen() {
  try {
    const newStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false
    });

    const newTrack = newStream.getVideoTracks()[0];

    // 모든 피어의 비디오 트랙 교체
    Object.values(state.peers).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newTrack);
    });

    // 로컬 비디오 교체
    const oldTrack = state.stream.getVideoTracks()[0];
    state.stream.removeTrack(oldTrack);
    oldTrack.stop();
    state.stream.addTrack(newTrack);
    $('local-video').srcObject = state.stream;

    toast('공유 창이 변경됐어요', 'success');
  } catch (e) {
    toast('창 변경 취소', '');
  }
}

// 공유 중지
function stopShare() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  $('local-video').style.display = 'none';
  $('local-video').srcObject = null;
  $('share-placeholder').style.display = 'flex';

  Object.values(state.peers).forEach(pc => pc.close());
  state.peers = {};

  // 바 삭제
  $('control-bar').classList.add('hidden');
  $('restore-bar-btn').classList.remove('visible');

  toast('공유가 중지됐어요');
}

// ── 컨트롤 바 버튼들 ──────────────────────────────

// 공유 중지
$('stop-share-btn').addEventListener('click', () => {
  stopShare();
  socket.emit('pause-share', { roomId: state.roomId, paused: false });
});

// 마이크
$('mic-btn').addEventListener('click', () => {
  state.micEnabled = !state.micEnabled;
  if (state.audioStream) {
    state.audioStream.getAudioTracks().forEach(t => t.enabled = state.micEnabled);
  }
  $('mic-icon').textContent = state.micEnabled ? '🎤' : '🔇';
  $('mic-btn').classList.toggle('active', !state.micEnabled);
  socket.emit('mic-toggle', { roomId: state.roomId, enabled: state.micEnabled });
  toast(state.micEnabled ? '마이크 켜짐' : '마이크 꺼짐');
});

// 창 바꾸기
$('switch-screen-btn').addEventListener('click', switchScreen);

// 원격 마우스
$('remote-mouse-btn').addEventListener('click', () => {
  state.remoteMouse = !state.remoteMouse;
  $('remote-mouse-btn').classList.toggle('active', state.remoteMouse);
  socket.emit('toggle-remote-mouse', { roomId: state.roomId, allowed: state.remoteMouse });
  toast(state.remoteMouse ? '원격 마우스 허용됨' : '원격 마우스 해제됨');
});

// 일시정지
$('pause-btn').addEventListener('click', () => {
  state.paused = !state.paused;
  if (state.stream) {
    state.stream.getVideoTracks().forEach(t => t.enabled = !state.paused);
  }
  $('pause-icon').textContent = state.paused ? '▶' : '⏸';
  $('pause-btn').classList.toggle('active', state.paused);
  $('pause-overlay').classList.toggle('active', state.paused);
  socket.emit('pause-share', { roomId: state.roomId, paused: state.paused });
  toast(state.paused ? '일시정지됨' : '공유 재개됨');
});

// 참여자 패널
$('participants-btn').addEventListener('click', openPanel);
$('close-participants').addEventListener('click', closePanel);
$('panel-backdrop').addEventListener('click', closePanel);

function openPanel() {
  $('participants-panel').classList.add('open');
  $('panel-backdrop').classList.add('active');
}
function closePanel() {
  $('participants-panel').classList.remove('open');
  $('panel-backdrop').classList.remove('active');
}

// 바 숨기기 (공유 유지)
$('hide-bar-btn').addEventListener('click', () => {
  $('control-bar').classList.add('hidden');
  $('restore-bar-btn').classList.add('visible');
});

$('restore-bar-btn').addEventListener('click', () => {
  $('control-bar').classList.remove('hidden');
  $('restore-bar-btn').classList.remove('visible');
});

// 방 코드 복사
$('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomId);
  toast('코드 복사됨!', 'success');
});

// ═══════════════════════════════════════════════════
// DRAGGABLE CONTROL BAR
// ═══════════════════════════════════════════════════
(function() {
  const bar = $('control-bar');
  let dragging = false, startX, startY, origLeft, origBottom;

  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.bar-btn') || e.target.closest('button')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = bar.getBoundingClientRect();
    origLeft = rect.left;
    origBottom = window.innerHeight - rect.bottom;
    bar.style.transition = 'none';
    bar.style.transform = 'none';
    bar.style.left = origLeft + 'px';
    bar.style.bottom = origBottom + 'px';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    bar.style.left = (origLeft + dx) + 'px';
    bar.style.bottom = (origBottom - dy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      bar.style.transition = '';
    }
  });
})();

// ═══════════════════════════════════════════════════
// VIEWER SCREEN SETUP
// ═══════════════════════════════════════════════════
function setupViewerScreen(roomId) {
  $('viewer-room-code').textContent = roomId;
  $('viewer-status').textContent = '호스트 연결 대기 중...';
}

// ═══════════════════════════════════════════════════
// WebRTC — PEER CONNECTIONS
// ═══════════════════════════════════════════════════
async function createOfferTo(viewerId) {
  const pc = createPeerConnection(viewerId);

  if (state.stream) {
    state.stream.getTracks().forEach(t => pc.addTrack(t, state.stream));
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { targetId: viewerId, sdp: offer });
}

function createPeerConnection(peerId) {
  if (state.peers[peerId]) state.peers[peerId].close();

  const pc = new RTCPeerConnection(ICE_CONFIG);
  state.peers[peerId] = pc;

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { targetId: peerId, candidate: e.candidate });
    }
  };

  pc.ontrack = e => {
    // 뷰어 측에서 스트림 수신
    const video = $('remote-video');
    if (video && e.streams[0]) {
      video.srcObject = e.streams[0];
      $('viewer-status').textContent = '연결됨';
      toast('화면 공유 연결됨', 'success');
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      delete state.peers[peerId];
    }
  };

  return pc;
}

// ═══════════════════════════════════════════════════
// SOCKET EVENTS
// ═══════════════════════════════════════════════════

// 뷰어가 입장함 (호스트 수신)
socket.on('viewer-joined', async ({ viewerId, nickname }) => {
  toast(`${nickname}님이 입장했어요`);
  if (state.stream) {
    await createOfferTo(viewerId);
  } else {
    // 스트림 없으면 피어만 준비
    createPeerConnection(viewerId);
  }
});

// 호스트가 보낸 offer (뷰어 수신)
socket.on('offer', async ({ sdp, fromId }) => {
  const pc = createPeerConnection(fromId);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { targetId: fromId, sdp: answer });
});

// 뷰어가 보낸 answer (호스트 수신)
socket.on('answer', async ({ sdp, fromId }) => {
  const pc = state.peers[fromId];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

// ICE candidate
socket.on('ice-candidate', async ({ candidate, fromId }) => {
  const pc = state.peers[fromId];
  if (pc && candidate) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  }
});

// 뷰어 나감
socket.on('viewer-left', ({ viewerId }) => {
  if (state.peers[viewerId]) {
    state.peers[viewerId].close();
    delete state.peers[viewerId];
  }
  removeCursor(viewerId);
});

// 호스트 나감 (뷰어 수신)
socket.on('host-left', () => {
  toast('호스트가 공유를 종료했어요', 'error');
  $('remote-video').srcObject = null;
  $('viewer-status').textContent = '연결 끊김';
  setTimeout(() => showScreen('home'), 2000);
});

// 마이크 상태 (뷰어 수신)
socket.on('host-mic-changed', ({ enabled }) => {
  $('viewer-status').textContent = enabled ? '마이크 켜짐' : '마이크 꺼짐';
});

// 일시정지 (뷰어 수신)
socket.on('share-paused', ({ paused }) => {
  $('viewer-pause-overlay').classList.toggle('active', paused);
});

// 원격 마우스 허용 여부
socket.on('remote-mouse-permission', ({ allowed }) => {
  state.remoteMouse = allowed;
  if (!state.isHost) {
    const video = $('remote-video');
    if (allowed) {
      video.style.cursor = 'crosshair';
      video.addEventListener('mousemove', onViewerMouseMove);
      video.addEventListener('click', onViewerClick);
    } else {
      video.style.cursor = '';
      video.removeEventListener('mousemove', onViewerMouseMove);
      video.removeEventListener('click', onViewerClick);
    }
    toast(allowed ? '마우스 제어 허용됨' : '마우스 제어 해제됨');
  }
});

// 참여자 목록 업데이트
socket.on('participants-updated', ({ participants }) => {
  state.participants = participants;
  $('participant-count').textContent = participants.length;
  renderParticipants(participants);
});

// 에러
socket.on('error', ({ message }) => {
  toast(message, 'error');
});

// ═══════════════════════════════════════════════════
// REMOTE MOUSE — VIEWER SIDE (sending events)
// ═══════════════════════════════════════════════════
function getRelativePos(e, videoEl) {
  const rect = videoEl.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height
  };
}

function onViewerMouseMove(e) {
  const pos = getRelativePos(e, $('remote-video'));
  socket.emit('cursor-move', { roomId: state.roomId, x: pos.x, y: pos.y });
  socket.emit('remote-mouse-event', {
    roomId: state.roomId,
    event: { type: 'mousemove', x: pos.x, y: pos.y }
  });
}

function onViewerClick(e) {
  const pos = getRelativePos(e, $('remote-video'));
  socket.emit('remote-mouse-event', {
    roomId: state.roomId,
    event: { type: 'click', x: pos.x, y: pos.y, button: e.button }
  });
}

// ═══════════════════════════════════════════════════
// REMOTE MOUSE — HOST SIDE (receiving events)
// ═══════════════════════════════════════════════════

// 호스트: 원격 마우스 이벤트 수신 (실제 마우스 이동은 OS 레벨 필요 — 여기선 커서 오버레이)
socket.on('remote-mouse-event', ({ fromId, nickname, event }) => {
  if (!state.isHost) return;
  updateRemoteCursor(fromId, nickname, event.x, event.y, 'remote-cursors');
});

// 커서 위치 수신 (모든 사람)
socket.on('remote-cursor', ({ fromId, nickname, x, y }) => {
  const containerId = state.isHost ? 'remote-cursors' : 'viewer-remote-cursors';
  updateRemoteCursor(fromId, nickname, x, y, containerId);
});

const cursorTimers = {};

function updateRemoteCursor(id, nickname, xRatio, yRatio, containerId) {
  const container = $(containerId);
  if (!container) return;

  let el = container.querySelector(`[data-cursor-id="${id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'remote-cursor';
    el.dataset.cursorId = id;
    el.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3L19 12L12 13.5L9 20L5 3Z" fill="#5b4aff" stroke="white" stroke-width="1.5"/>
      </svg>
      <div class="remote-cursor-label">${nickname}</div>
    `;
    container.appendChild(el);
  }

  const rect = container.getBoundingClientRect();
  el.style.left = (xRatio * rect.width) + 'px';
  el.style.top  = (yRatio * rect.height) + 'px';

  // 비활성 후 제거
  clearTimeout(cursorTimers[id]);
  cursorTimers[id] = setTimeout(() => el.remove(), 5000);
}

function removeCursor(id) {
  document.querySelectorAll(`[data-cursor-id="${id}"]`).forEach(el => el.remove());
}

// ═══════════════════════════════════════════════════
// PARTICIPANTS RENDER
// ═══════════════════════════════════════════════════
function renderParticipants(participants) {
  const list = $('participant-list');
  list.innerHTML = '';
  participants.forEach(p => {
    const li = document.createElement('li');
    li.className = 'participant-item';
    li.innerHTML = `
      <div class="participant-avatar">${p.nickname.charAt(0).toUpperCase()}</div>
      <div>
        <div class="participant-name">${p.nickname}</div>
        <div class="participant-role">${p.isHost ? '호스트' : '참여자'}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════
// NOTE: 실제 OS 마우스 제어 (로�otJS 등)는 서버사이드
// Electron 앱이나 데스크탑 에이전트가 필요합니다.
// 현재 구현은 커서 오버레이를 통해 위치를 시각화합니다.
// ═══════════════════════════════════════════════════
