const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = [];

app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Video listesi endpoint'i
app.get('/api/videos', (req, res) => {
  const videosDir = path.join(__dirname, 'videos');
  
  try {
    const files = fs.readdirSync(videosDir);
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv'].includes(ext);
    });
    
    const videos = videoFiles.map(file => ({
      name: file,
      displayName: path.parse(file).name,
      path: `/videos/${file}`
    }));
    
    res.json(videos);
  } catch (error) {
    console.error('Video listesi alınırken hata:', error);
    res.status(500).json({ error: 'Video listesi alınamadı' });
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Yeni bağlantı:', socket.id);

  socket.on('set-name', (name) => {
    socket.username = name;
    users.push(name);
    io.emit('user-list', users);
    socket.broadcast.emit('set-name', name);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users = users.filter(u => u !== socket.username);
      io.emit('user-list', users);
    }
  });

  socket.on('play', () => { socket.broadcast.emit('play'); });
  socket.on('pause', () => { socket.broadcast.emit('pause'); });
  socket.on('seek', (time) => { socket.broadcast.emit('seek', time); });
  socket.on('chat', (data) => { socket.broadcast.emit('chat', data); });
  socket.on('video-changed', (data) => { socket.broadcast.emit('video-changed', data); });
  
  // WebRTC signaling için
  socket.on('webrtc-offer', (data) => { socket.broadcast.emit('webrtc-offer', data); });
  socket.on('webrtc-answer', (data) => { socket.broadcast.emit('webrtc-answer', data); });
  socket.on('webrtc-ice-candidate', (data) => { socket.broadcast.emit('webrtc-ice-candidate', data); });
  socket.on('voice-status', (data) => { socket.broadcast.emit('voice-status', data); });
});

server.listen(80, () => {
  console.log('✅ Sunucu çalışıyor: http://localhost:80');
}); 