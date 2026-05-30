const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public'), { setHeaders: (res, path) => { if (path.endsWith('.css')) res.setHeader('Content-Type', 'text/css'); if (path.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); } }));

// 방 목록: { roomId: { host: socketId, participants: [socketId, ...], hostAllowsMouse: bool } }
const rooms = {};

// 방 생성
app.post('/api/room', (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  rooms[roomId] = { host: null, participants: [], hostAllowsMouse: false };
  res.json({ roomId });
});

// 방 정보 조회
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: '방이 없습니다.' });
  res.json({ exists: true, participantCount: room.participants.length });
});

// 모든 경로를 index.html로 라우팅
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

io.on('connection', (socket) => {
  console.log(`[연결] ${socket.id}`);

  // ── 방 입장 ──────────────────────────────────────────────
  socket.on('join-room', ({ roomId, isHost, nickname }) => {
    if (!rooms[roomId]) {
      socket.emit('error', { message: '존재하지 않는 방입니다.' });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.nickname = nickname || '익명';
    socket.data.isHost = isHost;

    if (isHost) {
      rooms[roomId].host = socket.id;
    } else {
      rooms[roomId].participants.push(socket.id);
    }

    // 방의 모든 사람에게 참여자 목록 갱신
    broadcastParticipants(roomId);

    // 호스트가 아닌 경우 호스트에게 offer 요청
    if (!isHost && rooms[roomId].host) {
      io.to(rooms[roomId].host).emit('viewer-joined', {
        viewerId: socket.id,
        nickname: socket.data.nickname
      });
    }

    socket.emit('joined', {
      roomId,
      isHost,
      hostAllowsMouse: rooms[roomId].hostAllowsMouse
    });

    console.log(`[입장] ${socket.data.nickname} → 방 ${roomId} (호스트: ${isHost})`);
  });

  // ── WebRTC 시그널링 ──────────────────────────────────────
  socket.on('offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('offer', { sdp, fromId: socket.id });
  });

  socket.on('answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('answer', { sdp, fromId: socket.id });
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', { candidate, fromId: socket.id });
  });

  // ── 마이크 상태 ──────────────────────────────────────────
  socket.on('mic-toggle', ({ roomId, enabled }) => {
    socket.to(roomId).emit('host-mic-changed', { enabled });
  });

  // ── 일시정지 ─────────────────────────────────────────────
  socket.on('pause-share', ({ roomId, paused }) => {
    socket.to(roomId).emit('share-paused', { paused });
  });

  // ── 원격 마우스 제어 허용/거부 ────────────────────────────
  socket.on('toggle-remote-mouse', ({ roomId, allowed }) => {
    if (rooms[roomId]) {
      rooms[roomId].hostAllowsMouse = allowed;
      io.to(roomId).emit('remote-mouse-permission', { allowed });
    }
  });

  // ── 원격 마우스 이벤트 (뷰어 → 호스트) ───────────────────
  socket.on('remote-mouse-event', ({ roomId, event }) => {
    const room = rooms[roomId];
    if (!room || !room.hostAllowsMouse) return;
    if (room.host) {
      io.to(room.host).emit('remote-mouse-event', {
        fromId: socket.id,
        nickname: socket.data.nickname,
        event
      });
    }
  });

  // ── 원격 마우스 커서 위치 브로드캐스트 (뷰어 → 다른 뷰어들) ──
  socket.on('cursor-move', ({ roomId, x, y }) => {
    const room = rooms[roomId];
    if (!room || !room.hostAllowsMouse) return;
    socket.to(roomId).emit('remote-cursor', {
      fromId: socket.id,
      nickname: socket.data.nickname,
      x, y
    });
  });

  // ── 연결 해제 ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];

    if (room.host === socket.id) {
      // 호스트 나감 → 방 종료
      io.to(roomId).emit('host-left');
      delete rooms[roomId];
      console.log(`[종료] 방 ${roomId} — 호스트 퇴장`);
    } else {
      // 뷰어 나감
      room.participants = room.participants.filter(id => id !== socket.id);
      broadcastParticipants(roomId);
      if (room.host) {
        io.to(room.host).emit('viewer-left', { viewerId: socket.id });
      }
    }

    console.log(`[퇴장] ${socket.data.nickname}`);
  });

  // ── 참여자 목록 브로드캐스트 헬퍼 ────────────────────────
  function broadcastParticipants(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const allSockets = [...io.sockets.adapter.rooms.get(roomId) || []];
    const participantList = allSockets.map(sid => {
      const s = io.sockets.sockets.get(sid);
      return {
        id: sid,
        nickname: s?.data?.nickname || '익명',
        isHost: s?.data?.isHost || false
      };
    });

    io.to(roomId).emit('participants-updated', { participants: participantList });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📡 시그널링 서버 준비 완료\n`);
});
