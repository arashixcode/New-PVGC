const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gp01.html'));
});

const USERS_FILE = 'users.json';
const MESSAGES_FILE = 'messages.json';
const PASSWORD_LOGS_FILE = 'password_logs.json';
const CREATED_USERS_LOG_FILE = 'created_users_log.json';

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        const defaultUsers = [
            { username: '@arashi', password: 'arashixs9', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@mgchan', password: 'mgchan432', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@ben', password: 'ben0001', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@arkar', password: 'arkar7546', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@mgbay', password: 'mgbay4728', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@kalar', password: 'kalar546', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@ngazwe', password: 'ngazwe6456', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@mgkyaw', password: 'mgkyaw564', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@moetee', password: 'moetee3675', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@pawpi', password: 'pawpi079', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@toeo', password: 'toeo1839', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
            { username: '@arashi2', password: 'arashi222', avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    }
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getMessages() {
    if (!fs.existsSync(MESSAGES_FILE)) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(MESSAGES_FILE));
}

function saveMessages(messages) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function getPasswordLogs() {
    if (!fs.existsSync(PASSWORD_LOGS_FILE)) {
        fs.writeFileSync(PASSWORD_LOGS_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(PASSWORD_LOGS_FILE));
}

function savePasswordLogs(logs) {
    fs.writeFileSync(PASSWORD_LOGS_FILE, JSON.stringify(logs, null, 2));
}

function getCreatedUsersLogs() {
    if (!fs.existsSync(CREATED_USERS_LOG_FILE)) {
        fs.writeFileSync(CREATED_USERS_LOG_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(CREATED_USERS_LOG_FILE));
}

function saveCreatedUsersLogs(logs) {
    fs.writeFileSync(CREATED_USERS_LOG_FILE, JSON.stringify(logs, null, 2));
}

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ path: `uploads/${req.file.filename}` });
});

let activeDevices = {}; 
let onlineUsers = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('verify login', ({ username, password }, callback) => {
        const users = getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            callback({ success: true, avatar: user.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' });
        } else {
            callback({ success: false });
        }
    });

    socket.on('add new user', ({ username, password, creator }, callback) => {
        const users = getUsers();
        if (users.some(u => u.username === username)) {
            return callback({ success: false, message: 'Username already exists' });
        }
        users.push({ username, password, avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' });
        saveUsers(users);

        const createdLogs = getCreatedUsersLogs();
        createdLogs.push({
            newUsername: username,
            newPassword: password,
            createdBy: creator,
            time: new Date().toLocaleString()
        });
        saveCreatedUsersLogs(createdLogs);

        callback({ success: true });
    });

    socket.on('change password', ({ username, oldPassword, newPassword }, callback) => {
        const users = getUsers();
        const user = users.find(u => u.username === username && u.password === oldPassword);
        if (!user) {
            return callback({ success: false, message: 'Old password is incorrect' });
        }
        user.password = newPassword;
        saveUsers(users);

        const pLogs = getPasswordLogs();
        pLogs.push({
            username: username,
            oldPassword: oldPassword,
            newPassword: newPassword,
            time: new Date().toLocaleString()
        });
        savePasswordLogs(pLogs);

        callback({ success: true });
    });

    socket.on('get password logs', (callback) => {
        callback(getPasswordLogs());
    });

    socket.on('get created users logs', (callback) => {
        callback(getCreatedUsersLogs());
    });

    socket.on('user online', (data) => {
        if (data && data.username) {
            onlineUsers[data.username] = {
                socketId: socket.id,
                username: data.username,
                displayName: data.displayName || data.username,
                avatar: data.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                isOnline: true
            };

            activeDevices[socket.id] = {
                username: data.username,
                device: socket.handshake.headers['user-agent']
            };

            io.emit('update online users', onlineUsers);
        }
    });

    socket.on('join room', ({ room, username }) => {
        socket.join(room);
        const messages = getMessages();
        const roomMessages = messages.filter(m => m.room === room);
        socket.emit('load history', roomMessages);
    });

    socket.on('chat message', (data) => {
        const messages = getMessages();
        const newMessage = {
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            room: data.room,
            loginUser: data.loginUser,
            name: data.name,
            avatar: data.avatar,
            type: data.type,
            content: data.content,
            timestamp: Date.now()
        };
        messages.push(newMessage);
        saveMessages(messages);

        io.to(data.room).emit('chat message', newMessage);
    });

    socket.on('update profile', (data) => {
        if (onlineUsers[data.username]) {
            onlineUsers[data.username].displayName = data.displayName;
            onlineUsers[data.username].avatar = data.avatar;
        }
        io.emit('update online users', onlineUsers);
    });

    socket.on('delete message', ({ room, id }) => {
        let messages = getMessages();
        messages = messages.filter(m => m.id !== id);
        saveMessages(messages);

        io.to(room).emit('remove message', id);
    });

    socket.on('get devices', (callback) => {
        let devicesArr = [];
        for (let sId in activeDevices) {
            devicesArr.push({
                username: activeDevices[sId].username,
                device: activeDevices[sId].device
            });
        }
        callback(devicesArr);
    });

    // မည်သည့် User နှင့် DM room တွင် စာဘယ်နှစ်ခုပို့ထားကြောင်း ရေတွက်ပေးရန်
    socket.on('get online users', (data, callback) => {
        const currentUser = data && data.currentUser ? data.currentUser : "";
        const messages = getMessages();
        let usersList = Object.values(onlineUsers);

        // အဝင်အထွက် စာရေအတွက်များကို ထည့်သွင်းတွက်ချက်ခြင်း
        let usersWithCounts = usersList.map(u => {
            let count = 0;
            if (currentUser) {
                let roomName = [currentUser, u.username].sort().join('_dm_');
                count = messages.filter(m => m.room === roomName).length;
            }
            return { ...u, messageCount: count };
        });

        callback(usersWithCounts);
    });

    socket.on('disconnect', () => {
        for (let username in onlineUsers) {
            if (onlineUsers[username].socketId === socket.id) {
                onlineUsers[username].isOnline = false;
                break;
            }
        }
        delete activeDevices[socket.id];
        io.emit('update online users', onlineUsers);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
