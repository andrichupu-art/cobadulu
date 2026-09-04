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
