const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  // ============================================
  // 관리자 계정 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ============================================
  // CRM: 고객사 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      status TEXT DEFAULT 'lead',
      interest TEXT DEFAULT '[]',
      contract_amount INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ============================================
  // CRM: 고객 히스토리 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      type TEXT DEFAULT 'other',
      date TEXT,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);

  // ============================================
  // 강의 이력 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      title TEXT NOT NULL,
      client TEXT,
      client_id INTEGER,
      category TEXT DEFAULT '',
      participants INTEGER DEFAULT 0,
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'confirmed',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ============================================
  // 북콘서트: 참가자 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ============================================
  // 북콘서트: 설정 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // 기본 설정값
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('registration_closed', 'false');

  // ============================================
  // 감사 2025: 이름 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS thanks_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      message TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ============================================
  // 감사 2025: 등록 요청 테이블
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS thanks_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ============================================
  // 기본 관리자 계정 생성
  // ============================================
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (adminExists.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin1234', 10);
    db.prepare('INSERT INTO admins (email, password, name, role) VALUES (?, ?, ?, ?)').run(
      'admin@aileadershiplab.com',
      hashedPassword,
      '관리자',
      'superadmin'
    );
    console.log('기본 관리자 계정 생성: admin@aileadershiplab.com / admin1234');
  }

  console.log('데이터베이스 초기화 완료');
  return db;
}

module.exports = { getDb, initializeDatabase };
