-- Jenis permohonan baharu: pekerja mengemas kini maklumat yang perlu disahkan HR (bank, status perkahwinan, anak, KWSP, cukai, nama / no. KP).
-- Fail berasingan kerana nilai enum baharu tidak boleh digunakan dalam transaksi yang sama ia ditambah.
alter type request_type add value if not exists 'profile_change';
