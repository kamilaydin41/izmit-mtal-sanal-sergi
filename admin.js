
import { sb, getData, photoUrl, logoUrl } from "./api.js";

const $ = s => document.querySelector(s);

let cats = [], photos = [], settings = {};

const errorText = e => e?.message || String(e);

const check = ({ error }) => {
  if (error) throw error;
};

const el = (tag, text, className) => {
  const x = document.createElement(tag);
  if (text != null) x.textContent = text;
  if (className) x.className = className;
  return x;
};

const btn = (text, callback, className = "alt") => {
  const b = el("button", text, className);
  b.type = "button";
  b.onclick = () => run(callback);
  return b;
};

function notice(message) {
  $("#status").textContent = message || "";
}

async function run(fn) {
  try {
    notice("");
    await fn();
    await load();
  } catch (e) {
    notice("İşlem yapılamadı: " + errorText(e));
  }
}

// GİRİŞ İŞLEMİ
$("#lf").onsubmit = async e => {
  e.preventDefault();

  const go = $("#go");
  const err = $("#err");

  err.textContent = "";
  go.disabled = true;

  const { error } = await sb.auth.signInWithPassword({
    email: $("#u").value.trim(),
    password: $("#p").value
  });

  go.disabled = false;

  if (error) {
    err.textContent = "Giriş başarısız: " + error.message;
    return;
  }

  await show();
};

// ŞİFREMİ UNUTTUM
$("#forgot").onclick = async e => {
  e.preventDefault();

  const email = $("#u").value.trim();
  const err = $("#err");
  const link = $("#forgot");

  err.textContent = "";

  if (!email) {
    err.textContent = "Lütfen önce e-posta adresinizi girin.";
    $("#u").focus();
    return;
  }

  link.textContent = "Gönderiliyor...";
  link.style.pointerEvents = "none";

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo:
        "https://izmit-mtal-sanal-sergi.vercel.app/reset-password.html"
    });

    if (error) throw error;

    err.textContent =
      "Eğer bu e-posta kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.";

  } catch (error) {
    err.textContent =
      "Şifre yenileme isteği başarısız: " + errorText(error);
  } finally {
    link.textContent = "Şifremi unuttum";
    link.style.pointerEvents = "auto";
  }
};

// ŞİFRE GÖSTER / GİZLE
$("#tg").onclick = () => {
  const p = $("#p");

  p.type = p.type === "password" ? "text" : "password";

  $("#tg").textContent =
    p.type === "password" ? "Göster" : "Gizle";
};

// ÇIKIŞ
$("#out").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

// YÖNETİM PANELİNİ GÖSTER
async function show() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  await run(async () => {});
}

// VERİLERİ YÜKLE
async function load() {
  ({ cats, photos, settings } = await getData());

  $("#school-name").value = settings.school_name || "";
  $("#exhibition-title").value =
    settings.exhibition_title || "Sanal Sergi";

  $("#logo-current").replaceChildren();

  if (settings.logo_path) {
    const img = el("img");
    img.src = logoUrl(settings.logo_path);
    img.alt = "Güncel okul logosu";
    img.className = "logo-preview";
    $("#logo-current").append(img);
  }

  renderCategories();
  renderPhotos();
}

// OKUL AYARLARINI KAYDET
$("#settings-form").onsubmit = e => {
  e.preventDefault();

  run(async () => {
    let logo_path = settings.logo_path;
    const file = $("#logo-file").files[0];

    if (file) {
      if (
        !file.type.match(/^image\/(png|jpeg|webp)$/) ||
        file.size > 5 * 1024 * 1024
      ) {
        throw new Error(
          "Logo PNG/JPG/WEBP ve en fazla 5 MB olmalı."
        );
      }

      const ext =
        file.type === "image/png" ? "png" :
        file.type === "image/webp" ? "webp" : "jpg";

      logo_path = `logo-${crypto.randomUUID()}.${ext}`;

      check(await sb.storage.from("branding").upload(
        logo_path,
        file,
        { contentType: file.type }
      ));
    }

    const previousLogo = settings.logo_path;

    const result = await sb.from("site_settings")
      .update({
        school_name: $("#school-name").value.trim(),
        exhibition_title: $("#exhibition-title").value.trim(),
        logo_path
      })
      .eq("id", 1);

    if (result.error) {
      if (file) {
        await sb.storage.from("branding").remove([logo_path]);
      }
      throw result.error;
    }

    if (file && previousLogo) {
      await sb.storage.from("branding").remove([previousLogo]);
    }

    $("#logo-file").value = "";
    notice("Okul bilgileri kaydedildi.");
  });
};

// LOGOYU KALDIR
$("#remove-logo").onclick = () => run(async () => {
  if (!settings.logo_path) return;

  check(await sb.from("site_settings")
    .update({ logo_path: null })
    .eq("id", 1));

  check(await sb.storage.from("branding")
    .remove([settings.logo_path]));
});

// YENİ BÖLÜM EKLE
$("#add-category").onsubmit = e => {
  e.preventDefault();

  run(async () => {
    const name = $("#new-name").value.trim();
    const quota = Number($("#new-quota").value);

    if (
      !name ||
      !Number.isInteger(quota) ||
      quota < 1 ||
      quota > 200
    ) {
      throw new Error(
        "Geçerli bölüm adı ve 1-200 arasında kapasite girin."
      );
    }

    check(await sb.from("categories").insert({
      name,
      quota,
      color: $("#new-color").value,
      sort: cats.length
        ? Math.max(...cats.map(c => c.sort)) + 1
        : 1
    }));

    $("#new-name").value = "";
  });
};

// BÖLÜMLERİ GÖSTER
function renderCategories() {
  const root = $("#category-controls");
  root.replaceChildren();

  if (!cats.length) {
    root.append(el("p", "Henüz bölüm eklenmemiş."));
  }

  for (const [index, c] of cats.entries()) {
    const line = el("div", null, "category-edit");

    const name = el("input");
    name.value = c.name;
    name.maxLength = 100;
    name.setAttribute("aria-label", "Bölüm adı");

    const quota = el("input");
    quota.type = "number";
    quota.min = 1;
    quota.max = 200;
    quota.value = c.quota;
    quota.setAttribute("aria-label", "Fotoğraf kapasitesi");
    quota.className = "quota-input";

    const color = el("input");
    color.type = "color";
    color.value = /^#[0-9a-f]{6}$/i.test(c.color)
      ? c.color : "#2f6fb3";
    color.className = "color-input";
    color.setAttribute("aria-label", "Bölüm rengi");

    line.append(
      name,
      quota,
      color,

      btn("Kaydet", async () => {
        const n = Number(quota.value);
        const occupied = photos.filter(p => p.category === c.id);

        if (
          !name.value.trim() ||
          !Number.isInteger(n) ||
          n < 1 ||
          n > 200
        ) {
          throw new Error("Bölüm adı ve kapasite geçersiz.");
        }

        if (occupied.some(p => p.slot >= n)) {
          throw new Error(
            "Kapasiteyi küçültmeden önce son yuvalardaki fotoğrafları silin."
          );
        }

        check(await sb.from("categories")
          .update({
            name: name.value.trim(),
            quota: n,
            color: color.value
          })
          .eq("id", c.id));
      }),

      btn("↑", async () => move(index, -1)),
      btn("↓", async () => move(index, 1)),

      btn("Sil", async () => {
        if (photos.some(p => p.category === c.id)) {
          throw new Error(
            "Bölümü silmeden önce içindeki fotoğrafları silin."
          );
        }

        if (!confirm(`${c.name} bölümü silinsin mi?`)) return;

        check(await sb.from("categories")
          .delete()
          .eq("id", c.id));
      }, "del")
    );

    root.append(line);
  }
}

// BÖLÜM SIRALAMASI
async function move(index, dir) {
  const other = cats[index + dir];

  if (!other) return;

  const a = cats[index];

  check(await sb.from("categories")
    .update({ sort: other.sort })
    .eq("id", a.id));

  check(await sb.from("categories")
    .update({ sort: a.sort })
    .eq("id", other.id));
}

// FOTOĞRAFLARI GÖSTER
function renderPhotos() {
  const root = $("#list");
  root.replaceChildren();

  for (const c of cats) {
    const mine = photos.filter(p => p.category === c.id);
    const left = c.quota - mine.length;

    const sec = el("section", null, "cat");
    const head = el("div", null, "cathead");

    head.append(
      el("h2", c.name),
      el("span", `Kalan hak: ${left} / ${c.quota}`,
        `left ${left ? "" : "zero"}`)
    );

    const grid = el("div", null, "grid");

    for (let i = 0; i < c.quota; i++) {
      const p = mine.find(x => x.slot === i);
      const d = el("div", null, p ? "slot" : "slot empty");

      if (p) {
        const img = el("img");
        img.src = photoUrl(p.path);
        img.alt = p.title || "Sergi fotoğrafı";

        const actions = el("div", null, "b");

        actions.append(
          btn("Değiştir", () => replace(p)),
          btn("Sil", () => remove(p), "del")
        );

        d.append(
          img,
          el("div", p.title || "(Başlıksız)", "t"),
          actions
        );
      } else {
        d.append(btn("+ Fotoğraf ekle", () => add(c.id, i)));
      }

      grid.append(d);
    }

    sec.append(head, grid);
    root.append(sec);
  }
}

// DOSYA SEÇ
function pick() {
  return new Promise(resolve => {
    const f = el("input");
    f.type = "file";
    f.accept = "image/*";
    f.onchange = () => resolve(f.files?.[0] || null);
    f.click();
  });
}

// FOTOĞRAF BOYUTLANDIR
async function shrink(file) {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    1600 / Math.max(bitmap.width, bitmap.height)
  );

  const canvas = el("canvas");

  canvas.width = Math.max(
    1, Math.round(bitmap.width * scale)
  );

  canvas.height = Math.max(
    1, Math.round(bitmap.height * scale)
  );

  canvas.getContext("2d").drawImage(
    bitmap, 0, 0, canvas.width, canvas.height
  );

  bitmap.close();

  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => blob
        ? resolve(blob)
        : reject(new Error("Fotoğraf işlenemedi.")),
      "image/jpeg",
      .85
    )
  );
}

// FOTOĞRAF YÜKLE
async function upload(cat, slot) {
  const file = await pick();

  if (!file) return null;

  const title = prompt("Fotoğraf başlığı:");
  if (title === null) return null;

  const descr = prompt("Kısa açıklama (isteğe bağlı):");
  if (descr === null) return null;

  const path = `${cat}/${crypto.randomUUID()}.jpg`;

  check(await sb.storage.from("photos").upload(
    path,
    await shrink(file),
    { contentType: "image/jpeg" }
  ));

  return { path, title, descr };
}

// FOTOĞRAF EKLE
async function add(cat, slot) {
  const u = await upload(cat, slot);

  if (!u) return;

  const { error } = await sb.from("photos")
    .insert({ category: cat, slot, ...u });

  if (error) {
    await sb.storage.from("photos").remove([u.path]);
    throw error;
  }
}

// FOTOĞRAF DEĞİŞTİR
async function replace(p) {
  const u = await upload(p.category, p.slot);

  if (!u) return;

  const { error } = await sb.from("photos")
    .update(u)
    .eq("id", p.id);

  if (error) {
    await sb.storage.from("photos").remove([u.path]);
    throw error;
  }

  check(await sb.storage.from("photos").remove([p.path]));
}

// FOTOĞRAF SİL
async function remove(p) {
  if (!confirm("Bu fotoğraf silinsin mi?")) return;

  check(await sb.from("photos")
    .delete()
    .eq("id", p.id));

  check(await sb.storage.from("photos")
    .remove([p.path]));
}

// MEVCUT OTURUMU KONTROL ET
sb.auth.getSession().then(({ data, error }) => {
  if (error) {
    $("#err").textContent = errorText(error);
    return;
  }

  if (data.session) show();
});
