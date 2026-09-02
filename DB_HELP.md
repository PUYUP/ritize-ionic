Ternyata saya menemukan **akar masalah utamanya**!

Di file konfigurasi migrasi Anda (`NotesDataSource.migration.ts`), Anda mengatur databasenya ke `:memory:` (database di dalam RAM). Ini adalah penyebab utama kenapa TypeORM *selalu* men-generate ulang seluruh tabel dari awal. 

Karena databasenya bersifat `:memory:`, setiap kali Anda menjalankan perintah `migration:generate`, TypeORM membuat database RAM baru yang **benar-benar kosong** (lupa dengan migrasi pertama). Karena mengira databasenya kosong, TypeORM otomatis membuat file migrasi `CREATE TABLE` lagi!

Saya sudah memperbaikinya dengan 2 hal:
1. Mengubah `:memory:` menjadi `migration.sqlite` di `NotesDataSource.migration.ts` agar TypeORM memiliki file database fisik lokal untuk mengingat status tabel terakhir.
2. Menambahkan 2 perintah baru di `package.json` Anda agar lebih mudah dijalankan.

---

### Contoh Workflow Menambahkan Kolom Baru (Ke Depannya)

Jika nanti Anda ingin menambahkan kolom baru (misal: menambah kolom `title` di entitas `notes`), ikuti 3 langkah ini:

**Langkah 1: Sinkronkan Database Lokal Anda Dulu**
Jalankan perintah ini agar file `migration.sqlite` yang baru kita buat mengenali migrasi-migrasi Anda yang sebelumnya:
```bash
npm run typeorm:migration:run
```

**Langkah 2: Tambahkan Kolom di Kode (Entity)**
Buka file entitas Anda (misal `notes.ts`) lalu tambahkan kolomnya, misalnya:
```typescript
@Column()
title: string;
```

Apabila database sudah memiliki data dan tidak ingin menghapus databasenya gunakan:

```typescript
@Column({ default: '' })
title: string;
```


**Langkah 3: Generate Migrasi Baru**
Jalankan perintah generate migrasi dengan memasukkan nama migrasinya (contoh: `AddTitleToNotes`). Jangan pakai script `...:initialNotes` lagi jika itu bukan migrasi awal. Gunakan script baru yang saya tambahkan:
```bash
npm run typeorm:migration:generate src/databases/migrations/notes/AddTitleToNotes
```

Jika Anda mengikuti 3 langkah ini, TypeORM akan membaca file `migration.sqlite` dan secara cerdas **hanya akan men-generate instruksi penambahan kolom saja**, sehingga Anda tidak perlu repot mengubah file migrasinya secara manual lagi!
