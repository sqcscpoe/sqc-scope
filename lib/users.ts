export interface User {
  id: string
  name: string
  company: string
  email: string
  passwordHash: string
  role: 'admin' | 'reviewer'
}

// To add a company: add an entry here.
// To generate a hash: node -e "const b=require('bcryptjs'); b.hash('yourpassword',10).then(console.log)"
export const USERS: User[] = [
  {
    id: '1',
    name: 'Admin SQC',
    company: 'SQC Scope',
    email: 'admin@sqcscope.com',
    passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    role: 'admin'
  }
]

export function getUserByEmail(email: string): User | undefined {
  return USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
}