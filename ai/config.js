// Uygulama sabitleri: sürüm, depolama anahtarları, hesap/sunucu ayarları. Başka modüle bağımlı değildir.

export const APP_VERSION = '6.9.44';

// localStorage anahtarları — kod içinde başka yerde anahtar dizesi yazılmaz.
// (index.html içindeki tema/açılış betikleri modül değildir; orada forge_ai_theme ve forge_ai_contrast elle yazılıdır.)
export const KEYS = {
  API: 'forge_ai_gemini_api_key',
  OR_API: 'forge_ai_openrouter_api_key',
  SYSTEM: 'forge_ai_system_prompt',
  CHATS: 'forge_ai_chats',
  CHATS_CORRUPT: 'forge_ai_chats_corrupt_backup',
  ACTIVE: 'forge_ai_active_chat',
  MODEL: 'forge_ai_v66_model',
  USER: 'forge_ai_user',
  TOKEN: 'forge_ai_idtoken',
  WEB: 'forge_ai_websearch',
  LIMIT: 'forge_ai_limit_state',
  HEALTH: 'forge_ai_model_health',
  SOUND: 'forge_ai_sound',
  NAME: 'forge_ai_name',
  ONBOARDED: 'forge_ai_onboarded',
  NOTIFY: 'forge_ai_notify',
  THEME: 'forge_ai_theme',
  CONTRAST: 'forge_ai_contrast',
  CLOUD_DEVICE: 'forge_cloud_device',
  CLOUD_META: 'forge_cloud_meta',
  CLOUD_UID: 'forge_cloud_uid'
};

// Eski sürümlerden kalan, artık kullanılmayan anahtarlar; uygulama açılırken silinir.
export const LEGACY_KEYS = ['forge_ai_groq_api_key', 'forge_ai_provider', 'forge_ai_temperature', 'forge_ai_memory'];

// Sunucu (proxy) adresi. Doluysa API anahtarı gerekmez; istekler bu adrese Google kimlik belgesiyle gider (proxy-worker.js).
export const PROXY_URL = '';

// Google ile giriş için OAuth Web Client ID (Google Cloud Console > Credentials). Boşsa giriş düğmesi kurulum bilgisi gösterir.
export const GOOGLE_CLIENT_ID = '278638845406-0u88a69tpajg2cc2vgt827m0j2kpp5qa.apps.googleusercontent.com';
