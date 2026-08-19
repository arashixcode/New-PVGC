const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const upload = multer({ dest: 'uploads/' });

app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Valid accounts storage (Admin can add new users dynamically)
let validAccounts = {
    "user_alpha": "AlphaPass#2026",
    "user_beta": "BetaPass#2026",
    "user_gamma": "GammaPass#2026",
    "user_delta": "DeltaPass#2026",
    "user_epsilon": "EpsPass#2026"
};

// Rooms history storage
let roomHistories = {
    "group": []
};

// Connected devices tracking
let connectedDevices = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gp01.html'));
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ path: req.file.path });
});

io.on('connection', (socket) => {
    const userAgent = socket.handshake.headers['user-agent'] || "Unknown Device";
    
    socket.on('verify login', ({ username, password }, callback) => {
        if (validAccounts[username] && validAccounts[username] === password) {
            connectedDevices[socket.id] = { username, device: userAgent };
            callback({ success: true });
        } else {
            callback({ success: false });
        }
    });

    socket.on('join room', ({ room, username }) => {
        socket.join(room);
        connectedDevices[socket.id] = { username, device: userAgent };
        
        if (!roomHistories[room]) roomHistories[room] = [];
        socket.emit('load history', roomHistories[room]);
    });

    socket.on('chat message', (msgData) => {
        const messageId = 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const fullMsg = { ...msgData, id: messageId };

        const room = msgData.room || 'group';
        if (!roomHistories[room]) roomHistories[room] = [];
        
        roomHistories[room].push(fullMsg);
        if (roomHistories[room].length > 150) roomHistories[room].shift();

        io.to(room).emit('chat message', fullMsg);
    });

    socket.on('delete message', ({ room, id }) => {
        const targetRoom = room || 'group';
        if (roomHistories[targetRoom]) {
            roomHistories[targetRoom] = roomHistories[targetRoom].filter(m => m.id !== id);
            io.to(targetRoom).emit('remove message', id);
        }
    });

    socket.on('add new user', ({ username, password }, callback) => {
        if (validAccounts[username]) {
            callback({ success: false, message: 'User already exists' });
        } else {
            validAccounts[username] = password;
            callback({ success: true });
        }
    });

    socket.on('get devices', (callback) => {
        const list = Object.values(connectedDevices);
        callback(list);
    });

    socket.on('get users list', (callback) => {
        callback(Object.keys(validAccounts));
    });

    socket.on('disconnect', () => {
        delete connectedDevices[socket.id];
    });
});

// Railway နှင့် ချိတ်ဆက်ရန် Port ကို မှန်ကန်စွာ သတ်မှတ်ခြင်း
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
