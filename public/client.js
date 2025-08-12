const socket = io();
const loginDiv = document.getElementById('login');
const mainDiv = document.getElementById('main');
const loginBtn = document.getElementById('loginBtn');
const usernameInput = document.getElementById('username');
const video = document.getElementById('video');
const userListDiv = document.getElementById('userList');

let myName = "";
let currentVideoPath = "";
let videos = [];

// Giriş işlemi
loginBtn.onclick = () => {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("ADINI VER İT");
    return;
  }
  myName = name;
  socket.emit('set-name', myName);
  loginDiv.style.display = 'none';
  mainDiv.style.display = '';
  loadVideos();
  video.play().catch(()=>{});
};

// Video olayları (oynatma/durdurma/atlama)
let isSeeking = false;

video.addEventListener('play', () => {
  if (!video.paused) socket.emit('play');
});
video.addEventListener('pause', () => {
  if (video.paused) socket.emit('pause');
});
video.addEventListener('seeking', () => {
  isSeeking = true;
});
video.addEventListener('seeked', () => {
  if (isSeeking) {
    socket.emit('seek', video.currentTime);
    isSeeking = false;
  }
});

// Gelen olaylar
socket.on('play', () => {
  if (video.paused) video.play().catch(()=>{});
});
socket.on('pause', () => {
  if (!video.paused) video.pause();
});
socket.on('seek', (time) => {
  if (Math.abs(video.currentTime - time) > 0.5) {
    video.currentTime = time;
  }
});

video.addEventListener('click', () => {
  if (video.paused) video.play().catch(()=>{});
});

// Chat sistemi
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

chatSend.onclick = sendChat;
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg || !myName) return;
  socket.emit('chat', { name: myName, msg });
  addChatMessage(myName, msg, true);
  chatInput.value = '';
}

socket.on('chat', ({ name, msg }) => {
  addChatMessage(name, msg, false);
});

function addChatMessage(name, msg, isMe) {
  const div = document.createElement('div');
  div.className = `chat-message ${isMe ? 'me' : 'other'}`;
  div.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-text">${msg}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (!isMe) showToast(`<b style="color: #6c7ce0; font-weight: 600;">${name}:</b> <span style="color: white;">${msg}</span>`);
}

// Kullanıcı listesi
socket.on('user-list', (users) => {
  userListDiv.innerHTML = '🌟 Online: ' + users.map(u => `<b style="color: #ff6b9d">${u}</b>`).join(', ');
});

// Sağ üstte mesaj bildirimi (toast)
function showToast(html) {
  const toast = document.getElementById('toast');
  toast.innerHTML = html;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.opacity = 1; }, 10);
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => { toast.style.display = 'none'; }, 400);
  }, 3500);
}

// Sesli sohbet sistemi
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isMicOn = false;
let isSpeakerOn = true;

const micBtn = document.getElementById('micBtn');
const speakerBtn = document.getElementById('speakerBtn');

// WebRTC konfigürasyonu
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Mikrofon butonu
micBtn.onclick = async () => {
  if (!isMicOn) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      isMicOn = true;
      micBtn.classList.add('active');
      micBtn.innerHTML = '<span>🎤</span><span>Açık</span>';
      socket.emit('voice-status', { name: myName, status: 'mic-on' });
      
      // Peer connection oluştur
      if (!peerConnection) {
        await createPeerConnection();
      }
      
      // Local stream'i peer connection'a ekle
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      
      // Offer oluştur ve gönder
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('webrtc-offer', offer);
      
    } catch (error) {
      console.error('Mikrofon erişim hatası:', error);
      alert('Mikrofon erişimi reddedildi veya hata oluştu!');
    }
  } else {
    // Mikrofonu kapat
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    isMicOn = false;
    micBtn.classList.remove('active');
    micBtn.innerHTML = '<span>🎤</span><span>Mikrofon</span>';
    socket.emit('voice-status', { name: myName, status: 'mic-off' });
    
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  }
};

// Hoparlör butonu
speakerBtn.onclick = () => {
  isSpeakerOn = !isSpeakerOn;
  if (isSpeakerOn) {
    speakerBtn.classList.add('active');
    speakerBtn.innerHTML = '<span>🔊</span><span>Açık</span>';
  } else {
    speakerBtn.classList.remove('active');
    speakerBtn.innerHTML = '<span>🔊</span><span>Kapalı</span>';
  }
  
  // Remote audio'yu sessize al/aç
  if (remoteStream) {
    remoteStream.getAudioTracks().forEach(track => {
      track.enabled = isSpeakerOn;
    });
  }
};

// Peer connection oluştur
async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);
  
  // ICE candidate olayı
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', event.candidate);
    }
  };
  
  // Remote stream olayı
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    
    // Remote audio'yu çal
    const remoteAudio = document.createElement('audio');
    remoteAudio.srcObject = remoteStream;
    remoteAudio.autoplay = true;
    remoteAudio.muted = !isSpeakerOn;
    document.body.appendChild(remoteAudio);
  };
}

// WebRTC signaling olayları
socket.on('webrtc-offer', async (offer) => {
  if (!peerConnection) {
    await createPeerConnection();
  }
  
  await peerConnection.setRemoteDescription(offer);
  
  // Mikrofon açıksa local stream'i ekle
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  // Answer oluştur ve gönder
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('webrtc-answer', answer);
});

socket.on('webrtc-answer', async (answer) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(answer);
  }
});

socket.on('webrtc-ice-candidate', async (candidate) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(candidate);
  }
});

// Ses durumu bildirimleri
socket.on('voice-status', ({ name, status }) => {
  let message = '';
  if (status === 'mic-on') {
    message = `${name} mikrofonunu açtı 🎤`;
  } else if (status === 'mic-off') {
    message = `${name} mikrofonunu kapattı 🔇`;
  }
  
  if (message) {
    showToast(message);
  }
});

// Video yönetimi ve ilerleme kaydetme sistemi
const videoListDiv = document.getElementById('videoList');
const refreshBtn = document.getElementById('refreshVideos');
const currentVideoNameSpan = document.getElementById('currentVideoName');
const videoInfoDiv = document.getElementById('videoInfo');

// Video listesini yükle
async function loadVideos() {
  try {
    videoListDiv.innerHTML = '<div class="loading">Videolar yükleniyor...</div>';
    
    const response = await fetch('/api/videos');
    videos = await response.json();
    
    if (videos.length === 0) {
      videoListDiv.innerHTML = `
        <div class="no-videos">
          <p>📁 Henüz video yok</p>
          <div class="upload-hint">
            Video dosyalarınızı "videos" klasörüne koyun<br>
            Desteklenen formatlar: MP4, WebM, OGG, AVI, MOV, MKV
          </div>
        </div>
      `;
      return;
    }
    
    videoListDiv.innerHTML = '';
    videos.forEach(videoData => {
      const videoItem = document.createElement('div');
      videoItem.className = 'video-item';
      videoItem.innerHTML = `
        <span class="video-item-icon">🎬</span>
        <div class="video-item-name">${videoData.displayName}</div>
      `;
      
      videoItem.onclick = () => selectVideo(videoData);
      videoListDiv.appendChild(videoItem);
    });
    
  } catch (error) {
    console.error('Video listesi yüklenirken hata:', error);
    videoListDiv.innerHTML = '<div class="loading">Video listesi yüklenemedi</div>';
  }
}

// Video seç
function selectVideo(videoData) {
  // Önceki seçimi kaldır
  document.querySelectorAll('.video-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Yeni seçimi işaretle
  event.target.closest('.video-item').classList.add('selected');
  
  // Video kaynağını değiştir
  currentVideoPath = videoData.path;
  video.src = videoData.path;
  currentVideoNameSpan.textContent = videoData.displayName;
  videoInfoDiv.style.display = 'block';
  
  // Kaydedilen ilerlemeyi yükle
  loadVideoProgress(videoData.name);
  
  // Diğer kullanıcılara video değişikliğini bildir
  socket.emit('video-changed', { path: videoData.path, name: videoData.displayName });
  
  showToast(`Video seçildi: ${videoData.displayName}`);
}

// İlerleme kaydetme sistemi
function saveVideoProgress(videoName, currentTime) {
  if (!videoName) return;
  
  const progressData = {
    currentTime: currentTime,
    timestamp: Date.now()
  };
  
  localStorage.setItem(`video_progress_${videoName}`, JSON.stringify(progressData));
}

// İlerleme yükleme
function loadVideoProgress(videoName) {
  if (!videoName) return;
  
  const savedProgress = localStorage.getItem(`video_progress_${videoName}`);
  if (savedProgress) {
    try {
      const progressData = JSON.parse(savedProgress);
      
      // 10 saniyeden fazla ise kaydedilen konumdan devam et
      if (progressData.currentTime > 10) {
        video.addEventListener('loadedmetadata', function setProgress() {
          video.currentTime = progressData.currentTime;
          video.removeEventListener('loadedmetadata', setProgress);
          showToast(`Kaldığınız yerden devam ediliyor: ${Math.floor(progressData.currentTime / 60)}:${Math.floor(progressData.currentTime % 60).toString().padStart(2, '0')}`);
        });
      }
    } catch (error) {
      console.error('İlerleme yüklenirken hata:', error);
    }
  }
}

// Video ilerleme kaydetme (her 5 saniyede bir)
let progressSaveInterval;
function startProgressTracking() {
  if (progressSaveInterval) clearInterval(progressSaveInterval);
  
  progressSaveInterval = setInterval(() => {
    if (currentVideoPath && !video.paused && video.currentTime > 0) {
      const videoName = currentVideoPath.split('/').pop();
      saveVideoProgress(videoName, video.currentTime);
    }
  }, 5000);
}

// Video olaylarına ilerleme kaydetme ekle
video.addEventListener('play', startProgressTracking);
video.addEventListener('pause', () => {
  if (currentVideoPath) {
    const videoName = currentVideoPath.split('/').pop();
    saveVideoProgress(videoName, video.currentTime);
  }
});

// Video değişikliği bildirimi
socket.on('video-changed', ({ path, name }) => {
  if (path !== currentVideoPath) {
    currentVideoPath = path;
    video.src = path;
    currentVideoNameSpan.textContent = name;
    videoInfoDiv.style.display = 'block';
    
    // Seçimi güncelle
    document.querySelectorAll('.video-item').forEach(item => {
      item.classList.remove('selected');
      if (item.querySelector('.video-item-name').textContent === name) {
        item.classList.add('selected');
      }
    });
    
    showToast(`${name} videosu seçildi`);
  }
});

// Yenile butonu
refreshBtn.onclick = loadVideos;

// Sayfa yüklendiğinde video listesini yükle
document.addEventListener('DOMContentLoaded', loadVideos);