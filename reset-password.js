
import { sb } from "./api.js";

const form = document.querySelector("#reset-form");
const message = document.querySelector("#message");

// Supabase, e-posta bağlantısından gelen oturumu
// URL üzerinden otomatik olarak doğrular.
async function checkRecoverySession() {
  message.textContent = "Bağlantı kontrol ediliyor...";

  const { data, error } = await sb.auth.getSession();

  if (error || !data.session) {
    message.textContent =
      "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş. Yeniden şifre sıfırlama isteği gönderin.";
    return;
  }

  message.textContent =
    "Bağlantı doğrulandı. Yeni şifrenizi belirleyebilirsiniz.";

  form.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.querySelector("#password").value;
  const password2 = document.querySelector("#password2").value;

  if (password.length < 8) {
    message.textContent = "Şifre en az 8 karakter olmalıdır.";
    return;
  }

  if (password !== password2) {
    message.textContent = "Şifreler eşleşmiyor.";
    return;
  }

  message.textContent = "Şifre güncelleniyor...";

  const { error } = await sb.auth.updateUser({
    password: password
  });

  if (error) {
    message.textContent = "Hata: " + error.message;
    return;
  }

  message.textContent =
    "Şifreniz başarıyla güncellendi. Yönetim paneline yönlendiriliyorsunuz.";

  setTimeout(async () => {
    await sb.auth.signOut();
    location.href = "admin.html";
  }, 2500);
});

checkRecoverySession();
