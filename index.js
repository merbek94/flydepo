// server.js
const express = require('express'); 
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Kök isteğine yanıt (tarayıcıda test için)
app.get('/', (req, res) => {
  res.send('Socket.IO sunucusu çalışıyor!');
});

let waitingPlayer = null;
const rooms = {}; // room -> { sequence, difficulty, sockets: [id,id] }

io.on("connection", socket => {
  console.log("Yeni bağlantı:", socket.id);

  socket.on("find_match", () => {
    console.log("find_match from", socket.id);
    if (waitingPlayer && waitingPlayer !== socket) {
      const room = "room-" + uuidv4();
      socket.join(room);
      waitingPlayer.join(room);
      rooms[room] = {
        sequence: null,
        difficulty: null,
        sockets: [waitingPlayer.id, socket.id]
      };
      socket.emit("match_found", { room, playerIndex: 1 });
      waitingPlayer.emit("match_found", { room, playerIndex: 0 });
      waitingPlayer = null;
      console.log("Eşleşme kuruldu:", room);
    } else {
      waitingPlayer = socket;
      socket.emit("waiting_for_opponent");
      console.log("Bekliyor:", socket.id);
    }
  });

  socket.on("set_sequence", ({ room, difficulty, sequence }) => {
    console.log("set_sequence alındı room:", room, "from:", socket.id);
    if (!rooms[room]) {
      console.warn("Bilinmeyen oda:", room);
      return;
    }
    rooms[room].sequence = sequence;
    rooms[room].difficulty = difficulty;
    socket.to(room).emit("set_sequence", { difficulty, sequence });
    socket.emit("sequence_set_ack");
  });

  socket.on("request_sequence", ({ room }) => {
    console.log("request_sequence from", socket.id, "for", room);
    const r = rooms[room];
    if (r && r.sequence) {
      socket.emit("set_sequence", {
        difficulty: r.difficulty,
        sequence: r.sequence
      });
    }
  });

  socket.on("progress_update", ({ room, placedCount, wrongCount }) => {
    socket.to(room).emit("progress_update", { placedCount, wrongCount });
  });

  socket.on("finished", ({ room, time }) => {
    socket.to(room).emit("finished", { time });
  });

  // kullanıcının "Evet, oyundan çıkmak istiyorum" dediği durum
  socket.on("leave_game", ({ room }) => {
    console.log("leave_game from", socket.id, "in", room);
    socket.to(room).emit("opponent_disconnected");
    if (rooms[room]) delete rooms[room];
    socket.leave(room);
  });

  socket.on("disconnect", () => {
    console.log("Ayrılan:", socket.id);
    if (waitingPlayer === socket) waitingPlayer = null;
    Array.from(socket.rooms)
      .filter(r => r !== socket.id)
      .forEach(room => {
        socket.to(room).emit("opponent_disconnected");
        delete rooms[room];
      });
  });
});

const port = process.env.PORT || 8080;
server.listen(port, "0.0.0.0", () => {
  console.log(`Socket.IO sunucusu ${port} portunda çalışıyor`);
});
