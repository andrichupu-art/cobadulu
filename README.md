# Catat Aja PWA

Aplikasi statis yang siap di-deploy ke GitHub Pages.

## Deploy melalui GitHub Pages

1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke root repository — termasuk folder `icons`.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`, lalu tekan **Save**.
6. Buka URL GitHub Pages yang diberikan GitHub.

PWA dapat di-install setelah dibuka melalui URL GitHub Pages karena GitHub Pages menggunakan HTTPS. Service worker dan cache offline tidak aktif jika file dibuka langsung dengan `file://`.

## Pengujian lokal

Dari folder ini jalankan server HTTP sederhana, lalu buka alamat localhost:

```bash
python3 -m http.server 8080
```

Buka `http://localhost:8080` di browser.

## Mengaktifkan Gemini AI

1. Buat API key Gemini di [Google AI Studio](https://aistudio.google.com/apikey).
2. Buka aplikasi, masuk ke **Lainnya → Pengaturan**.
3. Tempel key pada bagian **Gemini AI**, lalu tekan **Simpan Key**.
4. Tekan **Tes AI** untuk memastikan koneksi berhasil.

Aplikasi memakai model `gemini-2.5-flash-lite`. Key disimpan di `localStorage` perangkat pengguna dan tidak disimpan di repository. Untuk penggunaan publik berskala besar, gunakan Firebase AI Logic + App Check atau backend proxy agar key dan kuota lebih terlindungi.
