import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

export type Role = 'super_admin' | 'operations' | 'field_user'

export interface User {
  id: string
  name: string
  email: string
  company: string
  passwordHash: string
  role: Role
  createdAt: string
}

export const SUPER_ADMIN_EMAIL = 'sqsscope@gmail.com'

const DATA_DIR = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

function ensureDataDir() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
}

// Hash for default password 'password'
const DEFAULT_HASH = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'

function getDefaultUsers(): User[] {
  return [
    {
      id: '1',
      name: 'Super Admin',
      email: SUPER_ADMIN_EMAIL,
      company: 'SQC Scope',
      passwordHash: DEFAULT_HASH,
      role: 'super_admin',
      createdAt: new Date().toISOString()
    }
  ]
}

export function loadUsers(): User[] {
  ensureDataDir()
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8')
      const users = JSON.parse(data)
      if (Array.isArray(users) && users.length > 0) return users
    }
  } catch (e) { console.error('Error loading users:', e) }
  const defaults = getDefaultUsers()
  saveUsers(defaults)
  return defaults
}

export function saveUsers(users: User[]) {
  ensureDataDir()
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  } catch (e) { console.error('Error saving users:', e) }
}

export function getUserByEmail(email: string): User | null {
  const users = loadUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

export function getUserById(id: string): User | null {
  const users = loadUsers()
  return users.find(u => u.id === id) || null
}

export function createUser(data: { name: string; email: string; password: string; role: Role; company?: string }): User {
  const users = loadUsers()
  if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese email')
  }
  const passwordHash = bcrypt.hashSync(data.password, 10)
  const newUser: User = {
    id: Date.now().toString(),
    name: data.name,
    email: data.email.toLowerCase(),
    company: data.company || 'SQC Scope',
    passwordHash,
    role: data.role,
    createdAt: new Date().toISOString()
  }
  users.push(newUser)
  saveUsers(users)
  return newUser
}

export function deleteUser(id: string): boolean {
  const users = loadUsers()
  const user = users.find(u => u.id === id)
  if (!user) return false
  if (user.email === SUPER_ADMIN_EMAIL) throw new Error('No se puede eliminar al Super Admin')
  const filtered = users.filter(u => u.id !== id)
  saveUsers(filtered)
  return true
}

export function updateUserRole(id: string, role: Role): User | null {
  const users = loadUsers()
  const user = users.find(u => u.id === id)
  if (!user) return null
  if (user.email === SUPER_ADMIN_EMAIL && role !== 'super_admin') {
    throw new Error('No se puede cambiar el rol del Super Admin')
  }
  user.role = role
  saveUsers(users)
  return user
}

export function listUsers(): User[] {
  return loadUsers()
}
