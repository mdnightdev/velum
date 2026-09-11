export const CHAOS_PASSWORD = 'VelumChat1!';
export const CHAOS_PANIC_PHRASE = 'chaospanic';
export const CHAOS_SAFE_WORD = 'safeword';

export const NAME_POOL: readonly string[] = [
  'Alex', 'Jordan', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Harper', 'Logan', 'Blake',
  'Sofia', 'Lucia', 'Mateo', 'Diego', 'Ines', 'Hugo', 'Clara', 'Marco', 'Elena', 'Paolo',
  'Amelie', 'Julien', 'Camille', 'Noemi', 'Rafael', 'Carmen', 'Antonio', 'Isabel', 'Bruno', 'Chiara',
  'Soren', 'Freya', 'Lars', 'Ingrid', 'Mikael', 'Anika', 'Oskar', 'Greta', 'Nikolai', 'Anya',
  'Kaspar', 'Lenka', 'Tomas', 'Zofia', 'Marek', 'Ivana', 'Petra', 'Boris', 'Daria', 'Stefan',
  'Amira', 'Yusuf', 'Layla', 'Omar', 'Zahra', 'Karim', 'Noor', 'Samir', 'Leila', 'Farid',
  'Yasmin', 'Hassan', 'Rania', 'Tariq', 'Nour', 'Ayla', 'Emre', 'Zeynep', 'Deniz', 'Baran',
  'Aisha', 'Rohan', 'Priya', 'Arjun', 'Meera', 'Kabir', 'Ananya', 'Vikram', 'Sana', 'Dev',
  'Neha', 'Imran', 'Fatima', 'Raj', 'Kiran', 'Zoya', 'Aryan', 'Isha', 'Ravi', 'Mina',
  'Yuki', 'Haruki', 'Sakura', 'Ren', 'Hana', 'Kenji', 'Mei', 'Wei', 'Jin', 'Sora',
  'Minji', 'Joon', 'Hye', 'Anh', 'Linh', 'Hiro', 'Aoi', 'Nari', 'Suki', 'Tao',
  'Amara', 'Kwame', 'Zola', 'Tendai', 'Amina', 'Kofi', 'Nia', 'Jabari', 'Sefu', 'Imani',
  'Adaeze', 'Chidi', 'Zuri', 'Makena', 'Thabo', 'Ayo', 'Nala', 'Sanaa', 'Eshe', 'Tari',
  'Kai', 'Noa', 'Ari', 'Lux', 'Ora', 'Rex', 'Sky', 'Ash', 'Neo', 'Zen',
] as const;

export interface ChaosIdentity {
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
}

function normalizeBase(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  if (cleaned.length < 3) return 'User';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

export function allocateName(index: number, used: Set<string> = new Set()): string {
  const poolSize = NAME_POOL.length;
  if (poolSize === 0) throw new Error('NAME_POOL is empty');

  const start = ((index % poolSize) + poolSize) % poolSize;

  for (let offset = 0; offset < poolSize; offset++) {
    const base = normalizeBase(NAME_POOL[(start + offset) % poolSize]);
    const key = base.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return base;
    }
  }

  for (let n = 2; n <= 99; n++) {
    for (let offset = 0; offset < poolSize; offset++) {
      const base = normalizeBase(NAME_POOL[(start + offset) % poolSize]);
      const candidate = `${base}${n}`;
      const key = candidate.toLowerCase();
      if (!used.has(key)) {
        used.add(key);
        return candidate;
      }
    }
  }

  throw new Error('Naming pool exhausted');
}

export function allocateNames(count: number): string[] {
  const used = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(allocateName(i, used));
  }
  return names;
}

export function identityForUsername(username: string): ChaosIdentity {
  return {
    username,
    password: CHAOS_PASSWORD,
    panicPhrase: CHAOS_PANIC_PHRASE,
    safeWord: CHAOS_SAFE_WORD,
  };
}

export function clampAgentCount(requested: number, mode: 'local' | 'prod' = 'local'): number {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n) || n < 1) return 1;
  const cap = mode === 'prod' ? 100 : 10;
  return Math.min(n, cap);
}
