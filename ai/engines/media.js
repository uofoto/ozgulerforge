// Sohbet geçmişindeki görsel/PDF eklerini tanıyan yardımcılar.
export const DATA_URL = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

// Bu motor, geçmişteki eklerden en az birini gerçekten gönderecek mi?
export function hasMedia(hist, model) {
  return hist.some(h =>
    (model.vision && h.images.some(img => DATA_URL.test(img.dataUrl))) ||
    (model.pdf && h.pdfs.length > 0)
  );
}
