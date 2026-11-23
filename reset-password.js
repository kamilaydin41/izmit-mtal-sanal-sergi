
import { sb } from "./api.js";

const form = document.querySelector("#reset-form");
const message = document.querySelector("#message");

const params = new URLSearchParams(location.search);
const tokenHash = params.get("token_hash");
const type = params.get("type");

async function verifyLink() {
  if (!tokenHash || type !== "recovery") {
    message.textContent =
      "Şifre yenileme bağlantısı geçersiz. Yeni bir bağlantı isteyin.";
    return;
  }

  message.textContent = "Bağlantı doğrulanıyor...";

  const { error } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery"
  });

  if (error) {
    message.textContent =
      "Bağlantının süresi dolmuş veya bağlantı geçersiz. Yeni bir şifre yenileme e-postası isteyin.";
    return;
  }

  message.textContent = "Bağlantı doğrulandı. Yeni şifrenizi belirleyebilirsiniz.";
  form.classList.remove("hidden");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = document.querySelector("#password").value;
  const password2 = document.querySelector("#password2").value;

  if (password.length < 8) {
    message.textContent = "Şifre en az 8 karakter olmalıdır.";
    return;
  }

  if (password !== password2) {
    message.textContent = "Şifreler birbiriyle eşleşmiyor.";
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

  message.textContent = "Şifreniz başarıyla güncellendi. Yönetim paneline yönlendiriliyorsunuz.";

  setTimeout(() => {
    location.href = "admin.html";
  }, 2000);
});

verifyLink();
