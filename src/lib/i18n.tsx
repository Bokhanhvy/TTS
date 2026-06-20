import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "vi";

const DICT = {
  en: {
    "app.tagline": "Voice & Translation Studio",
    "hero.title.a": "One studio.",
    "hero.title.b": "Lifelike voices & flawless translation.",
    "hero.sub": "Generate native-sounding speech in 13 languages and translate any text with sentence-level bilingual mapping.",
    "tab.tts": "Text to Speech",
    "tab.translate": "Translate",
    "tts.script": "Your Script",
    "tts.placeholder": "Paste or type the text you want to speak...",
    "tts.preview": "Preview Current Text",
    "tts.stopPreview": "Stop Preview",
    "tts.previewHint": "Live preview — uses the real engine, so it matches the exported audio. Settings update after a short pause.",
    "tts.loadingPreview": "Loading preview…",
    "tts.previewFailed": "Preview failed — try again.",
    "tts.previewNeedsText": "Paste some text and select a voice first",
    "tts.chars": "chars",
    "tts.words": "words",
    "tts.audio": "audio",
    "tts.settings": "Voice Settings",
    "tts.tone": "Tone",
    "tts.advanced": "Advanced",
    "tts.emotion": "Emotion",
    "tts.speed": "Speed",
    "tts.pitch": "Pitch",
    "tts.volume": "Volume",
    "tts.emotionIntensity": "Emotion Intensity",
    "tts.expressiveness": "Expressiveness",
    "tts.stability": "Stability",
    "tts.naturalness": "Naturalness",
    "tts.pauseStrength": "Pause Strength",
    "tts.generate": "Generate Audio",
    "tts.rendering": "Rendering…",
    "tts.cancel": "Cancel",
    "tts.cancelGen": "Cancel Generation",
    "tts.library": "Voice Library",
    "tts.voices": "voices",
    "tts.allAges": "All ages",
    "tts.all": "All",
    "tts.female": "Female",
    "tts.male": "Male",
    "tts.output": "Audio Output",
    "tts.history": "History",
    "tts.searchHistory": "Search user, voice, language…",
    "tts.allUsers": "All users",
    "tts.allLangs": "All languages",
    "tts.noRecords": "No matching records.",
    "tts.presets": "Voice Presets",
    "tts.savePreset": "Save current as preset",
    "tts.presetName": "Preset name",
    "tts.noPreset": "No presets yet. Save current settings to compare A/B.",
    "tts.apply": "Apply",
    "tts.delete": "Delete",
    "tts.clearAll": "Clear all",
    "tts.cleared": "Cleared",
    "tr.autoDetect": "Auto-detect source",
    "tr.clear": "Clear",
    "tr.translate": "Translate",
    "tr.source": "Source",
    "tr.translation": "Translation",
    "tr.placeholder": "Paste any text here...",
    "tr.willAppear": "Translation will appear here…",
    "tr.mapping": "Bilingual Sentence Mapping",
    "tr.mappingHint": "Hover any sentence to highlight its pair",
  },
  vi: {
    "app.tagline": "Studio Giọng nói & Dịch thuật",
    "hero.title.a": "Một studio.",
    "hero.title.b": "Giọng đọc như người thật & dịch thuật hoàn hảo.",
    "hero.sub": "Tạo giọng đọc bản địa trên 13 ngôn ngữ và dịch văn bản với ánh xạ câu song ngữ.",
    "tab.tts": "Chuyển văn bản thành giọng nói",
    "tab.translate": "Dịch thuật",
    "tts.script": "Văn bản của bạn",
    "tts.placeholder": "Dán hoặc nhập văn bản bạn muốn đọc...",
    "tts.preview": "Nghe thử văn bản hiện tại",
    "tts.stopPreview": "Dừng nghe thử",
    "tts.previewHint": "Nghe thử dùng đúng engine xuất file, nên giống hệt audio tải về. Cài đặt áp dụng sau một nhịp ngắn.",
    "tts.loadingPreview": "Đang tải giọng thử…",
    "tts.previewFailed": "Nghe thử thất bại — thử lại nhé.",
    "tts.previewNeedsText": "Hãy nhập văn bản và chọn một giọng trước",
    "tts.chars": "ký tự",
    "tts.words": "từ",
    "tts.audio": "audio",
    "tts.settings": "Cài đặt giọng nói",
    "tts.tone": "Tông giọng",
    "tts.advanced": "Nâng cao",
    "tts.emotion": "Cảm xúc",
    "tts.speed": "Tốc độ",
    "tts.pitch": "Cao độ",
    "tts.volume": "Âm lượng",
    "tts.emotionIntensity": "Cường độ cảm xúc",
    "tts.expressiveness": "Biểu cảm",
    "tts.stability": "Ổn định",
    "tts.naturalness": "Tự nhiên",
    "tts.pauseStrength": "Độ ngắt nghỉ",
    "tts.generate": "Tạo Audio",
    "tts.rendering": "Đang tạo…",
    "tts.cancel": "Hủy",
    "tts.cancelGen": "Hủy tạo audio",
    "tts.library": "Thư viện giọng",
    "tts.voices": "giọng",
    "tts.allAges": "Mọi độ tuổi",
    "tts.all": "Tất cả",
    "tts.female": "Nữ",
    "tts.male": "Nam",
    "tts.output": "Audio đầu ra",
    "tts.history": "Lịch sử",
    "tts.searchHistory": "Tìm user, giọng, ngôn ngữ…",
    "tts.allUsers": "Tất cả người dùng",
    "tts.allLangs": "Tất cả ngôn ngữ",
    "tts.noRecords": "Không có bản ghi phù hợp.",
    "tts.presets": "Cấu hình giọng",
    "tts.savePreset": "Lưu cấu hình hiện tại",
    "tts.presetName": "Tên cấu hình",
    "tts.noPreset": "Chưa có cấu hình. Lưu thiết lập để so sánh A/B.",
    "tts.apply": "Áp dụng",
    "tts.delete": "Xóa",
    "tts.clearAll": "Xóa tất cả",
    "tts.cleared": "Đã xóa",
    "tr.autoDetect": "Tự nhận diện ngôn ngữ",
    "tr.clear": "Xóa",
    "tr.translate": "Dịch",
    "tr.source": "Nguồn",
    "tr.translation": "Bản dịch",
    "tr.placeholder": "Dán văn bản vào đây...",
    "tr.willAppear": "Bản dịch sẽ hiển thị tại đây…",
    "tr.mapping": "Ánh xạ câu song ngữ",
    "tr.mappingHint": "Di chuột vào câu để đánh dấu câu tương ứng",
  },
} as const;

type Key = keyof (typeof DICT)["en"];

const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "en" || saved === "vi") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };
  const t = (k: Key) => DICT[lang][k] ?? DICT.en[k] ?? k;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}