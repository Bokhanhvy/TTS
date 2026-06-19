export type Language = {
  code: string;
  label: string;
  bcp47: string; // Used to pick a real browser voice for preview
  sample: string;
};

export const LANGUAGES: Language[] = [
  { code: "en-US", label: "English (United States)", bcp47: "en-US", sample: "Hello, this is a natural sounding voice preview. I hope you like it." },
  { code: "en-GB", label: "English (United Kingdom)", bcp47: "en-GB", sample: "Good day. This is a sample of a British English voice." },
  { code: "en-AU", label: "English (Australia)", bcp47: "en-AU", sample: "G'day mate, this is an Australian English voice sample." },
  { code: "en-CA", label: "English (Canada)", bcp47: "en-CA", sample: "Hello there, this is a Canadian English voice sample." },
  { code: "vi-VN", label: "Vietnamese", bcp47: "vi-VN", sample: "Xin chào, đây là giọng đọc tiếng Việt tự nhiên và truyền cảm." },
  { code: "fr-FR", label: "French", bcp47: "fr-FR", sample: "Bonjour, ceci est un exemple de voix française naturelle." },
  { code: "de-DE", label: "German", bcp47: "de-DE", sample: "Hallo, dies ist eine natürliche deutsche Sprachprobe." },
  { code: "es-ES", label: "Spanish", bcp47: "es-ES", sample: "Hola, esta es una muestra de voz natural en español." },
  { code: "pt-BR", label: "Portuguese", bcp47: "pt-BR", sample: "Olá, esta é uma amostra de voz natural em português." },
  { code: "it-IT", label: "Italian", bcp47: "it-IT", sample: "Ciao, questo è un esempio di voce naturale in italiano." },
  { code: "ja-JP", label: "Japanese", bcp47: "ja-JP", sample: "こんにちは、これは自然な日本語の音声サンプルです。" },
  { code: "ko-KR", label: "Korean", bcp47: "ko-KR", sample: "안녕하세요, 자연스러운 한국어 음성 샘플입니다." },
  { code: "zh-CN", label: "Chinese", bcp47: "zh-CN", sample: "你好，这是一个自然的中文语音示例。" },
];

export type Voice = {
  id: string;
  name: string;
  gender: "Female" | "Male";
  age: 20 | 30 | 50 | 60;
  language: string; // language code
  accent: string;
  styles: string[];
  avatarSeed: string;
};

const FEMALE_NAMES: Record<string, string[]> = {
  "en": ["Emily", "Sophia", "Olivia", "Ava", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Emma", "Mia", "Ella", "Scarlett", "Grace", "Chloe", "Lily", "Zoe", "Hannah", "Aria", "Nora"],
  "vi": ["Linh", "Hương", "Mai", "Lan", "Hoa", "Trang", "Thảo", "Ngọc", "Phương", "Hà", "An", "Vy", "Yến", "Quỳnh", "Diệu", "Nhi", "Tâm", "Kim", "Hồng", "Thư"],
  "fr": ["Camille", "Léa", "Manon", "Chloé", "Sarah", "Emma", "Marie", "Louise", "Jade", "Inès", "Alice", "Juliette", "Zoé", "Lina", "Romane", "Eva", "Anna", "Lola", "Mila", "Lou"],
  "de": ["Anna", "Sophie", "Marie", "Laura", "Lena", "Lea", "Mia", "Hannah", "Emma", "Lina", "Klara", "Greta", "Frida", "Hilda", "Petra", "Heidi", "Erika", "Inga", "Brigitte", "Ulrike"],
  "es": ["Lucía", "Sofía", "María", "Martina", "Paula", "Daniela", "Valeria", "Camila", "Isabella", "Carmen", "Elena", "Sara", "Laura", "Andrea", "Natalia", "Julia", "Adriana", "Gabriela", "Patricia", "Beatriz"],
  "pt": ["Maria", "Ana", "Sofia", "Beatriz", "Mariana", "Inês", "Carolina", "Leonor", "Matilde", "Catarina", "Joana", "Margarida", "Rita", "Helena", "Clara", "Luísa", "Teresa", "Patrícia", "Cristina", "Diana"],
  "it": ["Sofia", "Giulia", "Aurora", "Alice", "Ginevra", "Emma", "Giorgia", "Greta", "Beatrice", "Anna", "Martina", "Chiara", "Sara", "Francesca", "Elena", "Vittoria", "Camilla", "Bianca", "Matilde", "Noemi"],
  "ja": ["Sakura", "Yui", "Hina", "Mei", "Aoi", "Rin", "Mio", "Akari", "Yuna", "Kaede", "Hana", "Saki", "Riko", "Nao", "Kanna", "Misaki", "Haruka", "Ayaka", "Emi", "Yuki"],
  "ko": ["Seoyeon", "Jiwoo", "Hayoon", "Seoyun", "Jia", "Jiyu", "Eunseo", "Yujin", "Soyul", "Minji", "Hayun", "Yuna", "Soeun", "Chaewon", "Dahyun", "Suah", "Yeeun", "Mihye", "Soojin", "Jisoo"],
  "zh": ["Mei", "Lin", "Yan", "Hui", "Xia", "Hong", "Ling", "Fang", "Jing", "Ying", "Hua", "Ping", "Min", "Qing", "Yun", "Lan", "Xiu", "Juan", "Na", "Li"],
};

const MALE_NAMES: Record<string, string[]> = {
  "en": ["Liam", "Noah", "Oliver", "Elijah", "James", "William", "Benjamin", "Lucas", "Henry", "Alexander", "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan", "Jackson", "Sebastian", "Aiden", "Owen"],
  "vi": ["Minh", "Anh", "Tuấn", "Nam", "Hùng", "Phong", "Bảo", "Khang", "Quang", "Đạt", "Dũng", "Hải", "Sơn", "Long", "Khoa", "Tài", "Phúc", "Vinh", "Nghĩa", "Trí"],
  "fr": ["Gabriel", "Louis", "Raphaël", "Jules", "Adam", "Lucas", "Léo", "Hugo", "Arthur", "Maël", "Liam", "Ethan", "Nathan", "Mathis", "Tom", "Théo", "Sacha", "Noah", "Antoine", "Pierre"],
  "de": ["Maximilian", "Alexander", "Paul", "Leon", "Elias", "Felix", "Jonas", "Lukas", "Noah", "Ben", "Finn", "Luis", "Henry", "Anton", "Oskar", "Karl", "Hans", "Sebastian", "Tobias", "Florian"],
  "es": ["Mateo", "Lucas", "Hugo", "Daniel", "Alejandro", "Pablo", "Álvaro", "Adrián", "Diego", "David", "Javier", "Sergio", "Carlos", "Miguel", "Antonio", "Manuel", "Rafael", "Fernando", "Andrés", "Pedro"],
  "pt": ["João", "Miguel", "Pedro", "Tomás", "Rodrigo", "Afonso", "Diogo", "Tiago", "Gabriel", "Francisco", "Martim", "Duarte", "Gonçalo", "André", "Bruno", "Rui", "Paulo", "Carlos", "José", "António"],
  "it": ["Leonardo", "Francesco", "Lorenzo", "Alessandro", "Mattia", "Andrea", "Gabriele", "Tommaso", "Riccardo", "Edoardo", "Matteo", "Giuseppe", "Antonio", "Marco", "Luca", "Davide", "Stefano", "Paolo", "Roberto", "Giovanni"],
  "ja": ["Haruto", "Yuto", "Sota", "Ren", "Hiroto", "Yuma", "Riku", "Takumi", "Daiki", "Kenta", "Kaito", "Sho", "Ryo", "Daichi", "Tatsuya", "Kazuki", "Yuki", "Akira", "Naoki", "Satoshi"],
  "ko": ["Minjun", "Seojun", "Hajun", "Dohyun", "Jiho", "Yejun", "Siwoo", "Juwon", "Eunwoo", "Geon", "Jihoon", "Sungmin", "Jaewon", "Hyunwoo", "Taemin", "Joon", "Hoseok", "Donghyun", "Jisung", "Minho"],
  "zh": ["Wei", "Lei", "Jun", "Hao", "Bo", "Yang", "Long", "Feng", "Tao", "Bin", "Gang", "Jie", "Chao", "Peng", "Yong", "Ming", "Kai", "Hui", "Liang", "Zhen"],
};

const STYLE_POOL = [
  "Conversational", "Friendly", "Professional", "Storytelling", "Podcast",
  "Narration", "Audiobook", "Documentary", "News Anchor", "Educational",
  "Marketing", "Corporate", "Emotional", "Customer Support", "Warm", "Natural",
];

function pickStyles(seed: number): string[] {
  const out: string[] = [];
  const n = 3 + (seed % 2);
  for (let i = 0; i < n; i++) {
    out.push(STYLE_POOL[(seed * (i + 7)) % STYLE_POOL.length]);
  }
  return Array.from(new Set(out));
}

const ACCENT_BY_LANG: Record<string, string> = {
  "en-US": "American", "en-GB": "British", "en-AU": "Australian", "en-CA": "Canadian",
  "vi-VN": "Vietnamese", "fr-FR": "Parisian", "de-DE": "Standard German",
  "es-ES": "Castilian", "pt-BR": "Brazilian", "it-IT": "Standard Italian",
  "ja-JP": "Tokyo", "ko-KR": "Seoul", "zh-CN": "Mandarin",
};

function nameGroup(langCode: string): string {
  const base = langCode.split("-")[0];
  return base;
}

export function buildVoicesForLanguage(lang: Language): Voice[] {
  const base = nameGroup(lang.code);
  const femaleNames = FEMALE_NAMES[base] ?? FEMALE_NAMES["en"];
  const maleNames = MALE_NAMES[base] ?? MALE_NAMES["en"];
  const ages: Voice["age"][] = [20, 30, 50, 60];
  const voices: Voice[] = [];
  let f = 0;
  let m = 0;
  ages.forEach((age, ageIdx) => {
    for (let i = 0; i < 5; i++) {
      const name = femaleNames[(ageIdx * 5 + i) % femaleNames.length];
      voices.push({
        id: `${lang.code}-F-${age}-${i}`,
        name,
        gender: "Female",
        age,
        language: lang.code,
        accent: ACCENT_BY_LANG[lang.code] ?? lang.label,
        styles: pickStyles(f++ + ageIdx * 3),
        avatarSeed: `${name}-${age}-f`,
      });
    }
  });
  ages.forEach((age, ageIdx) => {
    for (let i = 0; i < 5; i++) {
      const name = maleNames[(ageIdx * 5 + i) % maleNames.length];
      voices.push({
        id: `${lang.code}-M-${age}-${i}`,
        name,
        gender: "Male",
        age,
        language: lang.code,
        accent: ACCENT_BY_LANG[lang.code] ?? lang.label,
        styles: pickStyles(m++ + ageIdx * 5 + 100),
        avatarSeed: `${name}-${age}-m`,
      });
    }
  });
  return voices;
}

export function avatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}