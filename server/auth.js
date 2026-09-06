import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from './config.js';

const USERS_FILE = path.join(CONFIG.metaDir, 'users.json');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_salt_autodeploy_2026').digest('hex');
}

export class AuthManager {
  static loadUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      }
    } catch {}

    // Default seeded initial user (single role only, no admin/dev split)
    const defaultUsers = [
      {
        id: 'usr_default',
        username: 'developer',
        fullName: 'Software Engineer',
        passwordHash: hashPassword('dev123'),
        createdAt: new Date().toISOString()
      }
    ];

    try {
      fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    } catch {}

    return defaultUsers;
  }

  static saveUsers(users) {
    try {
      fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
      console.error('Error saving users file:', err.message);
    }
  }

  // Active sessions: token -> { userId, expiresAt }
  static sessions = new Map();

  static login(username, password) {
    const users = this.loadUsers();
    const cleanUser = (username || '').toLowerCase().trim();
    const passHash = hashPassword(password);

    const found = users.find(u => u.username.toLowerCase() === cleanUser && u.passwordHash === passHash);
    if (!found) {
      return { success: false, error: 'Username atau password salah' };
    }

    const token = 'token_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.sessions.set(token, { userId: found.id, expiresAt });

    const { passwordHash, ...userSafe } = found;
    return {
      success: true,
      token,
      user: userSafe
    };
  }

  static register(username, password, fullName = '') {
    const users = this.loadUsers();
    const cleanUser = (username || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

    if (!cleanUser || cleanUser.length < 3) {
      return { success: false, error: 'Username minimal 3 karakter huruf kecil/angka' };
    }
    if (!password || password.length < 5) {
      return { success: false, error: 'Password minimal 5 karakter' };
    }
    if (users.some(u => u.username.toLowerCase() === cleanUser)) {
      return { success: false, error: 'Username sudah digunakan' };
    }

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      username: cleanUser,
      fullName: fullName.trim() || cleanUser,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);

    const token = 'token_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    this.sessions.set(token, { userId: newUser.id, expiresAt });

    const { passwordHash, ...userSafe } = newUser;
    return {
      success: true,
      token,
      user: userSafe
    };
  }

  static verifyToken(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    const users = this.loadUsers();
    const user = users.find(u => u.id === session.userId);
    if (!user) return null;

    const { passwordHash, ...userSafe } = user;
    return userSafe;
  }

  static logout(token) {
    if (token) {
      this.sessions.delete(token);
    }
    return { success: true };
  }
}
