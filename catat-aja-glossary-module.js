// ============ SUPABASE CLIENT SETUP ============
const supabaseUrl = 'https://wycodpzildimadpxnkzt.supabase.co'; // GANTI dengan project URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y29kcHppbGRpbWFkcHhua3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODY1NTcsImV4cCI6MjEwNDE2MjU1N30.hdohU1CWDZtnIYv61Z4LAJaWcR6A9XrJtGECQIBz6do'; // GANTI dengan anon key
let supabase = null;
let currentUser = null;

async function initSupabase() {
  // Load Supabase library
  if (!window.supabase) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/dist/module.js';
    script.type = 'module';
    document.head.appendChild(script);
    
    // Tunggu hingga loaded
    await new Promise(r => setTimeout(r, 2000));
  }
  
  const { createClient } = window.supabase;
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Restore session kalau ada
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    console.log('✅ Supabase session restored:', currentUser.email);
  }
}

// ============ GLOSSARY SYSTEM ============
const Memory = {
  glossary: {}, // Cache from Supabase
  loading: false,
  
  // Load glossary dari Supabase ke memory
  async load() {
    if (!currentUser) return;
    if (this.loading) return;
    
    this.loading = true;
    try {
      const { data, error } = await supabase
        .from('glossary')
        .select('*')
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      
      this.glossary = {};
      data.forEach(row => {
        const key = row.term.toLowerCase();
        this.glossary[key] = {
          term: row.term,
          category: row.category,
          sub_type: row.sub_type,
          confidence: row.confidence
        };
      });
      
      console.log(`✅ Loaded ${data.length} glossary terms`);
    } catch (err) {
      console.error('❌ Failed to load glossary:', err);
    } finally {
      this.loading = false;
    }
  },
  
  // Cek apakah term sudah diketahui
  knows(term) {
    return this.glossary[term.toLowerCase()] !== undefined;
  },
  
  // Get definition dari memory
  get(term) {
    return this.glossary[term.toLowerCase()] || null;
  },
  
  // Simpan term baru ke Supabase
  async learn(term, category, sub_type = null, confidence = 100) {
    if (!currentUser) return false;
    
    try {
      const { error } = await supabase
        .from('glossary')
        .upsert({
          user_id: currentUser.id,
          term: term,
          category: category,
          sub_type: sub_type,
          confidence: confidence,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,term'
        });
      
      if (error) throw error;
      
      // Update local cache
      const key = term.toLowerCase();
      this.glossary[key] = { term, category, sub_type, confidence };
      
      console.log(`✅ Learned: "${term}" → ${category}`);
      return true;
    } catch (err) {
      console.error('❌ Failed to learn term:', err);
      return false;
    }
  },
  
  // Record unknown term (untuk analisis nanti)
  async recordUnknown(term, context = '') {
    if (!currentUser) return;
    
    try {
      const key = term.toLowerCase();
      
      // Cek kalau sudah ada
      const { data: existing } = await supabase
        .from('unknown_terms')
        .select('id, frequency, last_seen')
        .eq('user_id', currentUser.id)
        .eq('term', term)
        .single();
      
      if (existing) {
        // Update frequency
        await supabase
          .from('unknown_terms')
          .update({
            frequency: existing.frequency + 1,
            last_seen: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert baru
        await supabase
          .from('unknown_terms')
          .insert({
            user_id: currentUser.id,
            term: term,
            context: context
          });
      }
    } catch (err) {
      console.error('❌ Failed to record unknown term:', err);
    }
  },
  
  // Delete term dari glossary
  async forget(term) {
    if (!currentUser) return false;
    
    try {
      await supabase
        .from('glossary')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('term', term);
      
      delete this.glossary[term.toLowerCase()];
      console.log(`✅ Forgot: "${term}"`);
      return true;
    } catch (err) {
      console.error('❌ Failed to forget term:', err);
      return false;
    }
  },
  
  // Get semua unknown terms (untuk UI dashboard)
  async getUnknownTerms() {
    if (!currentUser) return [];
    
    try {
      const { data, error } = await supabase
        .from('unknown_terms')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('frequency', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('❌ Failed to get unknown terms:', err);
      return [];
    }
  }
};

// ============ TERM CLASSIFIER (HEURISTIC) ============
const Classifier = {
  // Prediksi kategori berdasarkan pattern
  predict(term) {
    const lower = term.toLowerCase();
    
    // Heuristic patterns
    const patterns = {
      pemasukan: [
        /^(gaji|upah|bayaran|income|bonus|komisi|THR|tunjangan|hasil|revenue|untung|profit)/i,
        /dari\s+(kantor|perusahaan|klien|customer|klien)/i,
        /(terima|dapat|masuk)/i
      ],
      pengeluaran: [
        /^(bayar|beli|beli|belanjas|makan|minum|bensin|listrik|air|pulsa|tagihan|biaya)/i,
        /untuk\s+/i,
        /(keluar|habis|dipakai)/i
      ],
      merchant: [
        /^(toko|warung|rumah makan|resto|kafe|salon|bengkel|apotek|minimarket|supermarket)/i,
        /(Toko|Warung|Rumah|Kedai)\s+\w+/
      ],
      person: [
        /^(bayar\s+)?(\w+)\s+(hutang|pinjam|bayar)?$/i,
        /nama\s+orang/i
      ]
    };
    
    for (const [category, patternList] of Object.entries(patterns)) {
      for (const pattern of patternList) {
        if (pattern.test(term)) {
          return category;
        }
      }
    }
    
    return 'custom'; // fallback
  },
  
  // Suggest sub-type berdasarkan category
  suggestSubType(category, term = '') {
    const suggestions = {
      pemasukan: ['gaji', 'bonus', 'komisi', 'freelance', 'hadiah', 'lainnya'],
      pengeluaran: ['makanan', 'transportasi', 'utilitas', 'belanja', 'hiburan', 'kesehatan', 'pendidikan', 'lainnya'],
      merchant: ['retail', 'f&b', 'jasa', 'transport', 'lainnya'],
      person: ['teman', 'keluarga', 'bisnis', 'lainnya'],
      custom: ['lainnya']
    };
    
    return suggestions[category] || suggestions.custom;
  }
};

// ============ VOICE INTENT INTEGRATION ============
// Patch Intent.handle() untuk menggunakan glossary

const OriginalIntentHandle = Intent && Intent.handle ? Intent.handle.bind(Intent) : null;

async function IntentHandleWithMemory(transcript) {
  // Pre-process: extract terms yang mungkin unknown
  const unknownTerms = await extractAndCheckTerms(transcript);
  
  if (unknownTerms.length > 0) {
    // Ada unknown terms — tanya user sebelum process
    console.log('🤔 Found unknown terms:', unknownTerms);
    await handleUnknownTermsFlow(unknownTerms, transcript);
    return;
  }
  
  // Semua terms known — process normally
  if (OriginalIntentHandle) {
    return OriginalIntentHandle(transcript);
  }
}

// Extract terms yang tidak ada di glossary
async function extractAndCheckTerms(transcript) {
  const words = transcript.split(/\s+/);
  const unknown = [];
  
  for (const word of words) {
    const clean = word.replace(/[^\w\s]/g, '').toLowerCase();
    if (clean.length > 3 && !Memory.knows(clean)) {
      // Pastikan bukan kata umum Indonesia
      if (!isCommonWord(clean)) {
        unknown.push(word);
      }
    }
  }
  
  return unknown;
}

// Kata-kata umum yang tidak perlu di-classify
function isCommonWord(word) {
  const common = [
    // Common Indonesian words
    'aku', 'saya', 'kamu', 'dia', 'kami', 'kalian', 'mereka',
    'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
    'dan', 'atau', 'tapi', 'jadi', 'dengan', 'untuk', 'dari', 'ke', 'di', 'pada', 'oleh',
    'yang', 'adalah', 'ada', 'tidak', 'ya', 'iya', 'nggak', 'ya',
    'apa', 'mana', 'siapa', 'kapan', 'dimana', 'kenapa', 'berapa',
    'baik', 'bagus', 'jelek', 'besar', 'kecil', 'panjang', 'pendek',
    'bayar', 'beli', 'dapat', 'masuk', 'keluar', 'buat', 'beri',
    // Voice AI common responses
    'transaksi', 'catatan', 'berhasil', 'gagal', 'selesai', 'diproses'
  ];
  return common.includes(word);
}

// Handle flow: tanya user untuk classify unknown terms
async function handleUnknownTermsFlow(unknownTerms, originalTranscript) {
  console.log('📝 Unknown terms flow initiated');
  
  // Group terms yang perlu diclassify
  const termsToLearn = unknownTerms.slice(0, 3); // Max 3 at once
  
  for (const term of termsToLearn) {
    await promptAndLearnTerm(term, originalTranscript);
  }
  
  // Setelah learn, ulang intent handle
  console.log('🔄 Retrying intent with learned terms...');
  if (OriginalIntentHandle) {
    return OriginalIntentHandle(originalTranscript);
  }
}

// Prompt user untuk classify satu term
async function promptAndLearnTerm(term, context) {
  return new Promise((resolve) => {
    const cleanTerm = term.replace(/[^\w\s]/g, '').trim();
    
    // Predict category
    const predictedCategory = Classifier.predict(cleanTerm);
    const suggestions = Classifier.suggestSubType(predictedCategory, cleanTerm);
    
    // Buka modal untuk user input
    const modal = document.getElementById('learnTermModal');
    if (!modal) {
      console.warn('learnTermModal not found');
      Memory.recordUnknown(term, context); // Just record as unknown
      resolve();
      return;
    }
    
    // Set content
    document.getElementById('learnTermText').textContent = cleanTerm;
    document.getElementById('learnTermCategory').value = predictedCategory;
    
    // Populate sub-type suggestions
    const subTypeSelect = document.getElementById('learnTermSubType');
    subTypeSelect.innerHTML = suggestions
      .map(s => `<option value="${s}">${s}</option>`)
      .join('');
    
    // Set context
    document.getElementById('learnTermContext').value = context;
    
    // Open modal
    openModal('learnTermModal');
    
    // Handle save
    const onSave = async () => {
      const category = document.getElementById('learnTermCategory').value;
      const sub_type = document.getElementById('learnTermSubType').value;
      
      await Memory.learn(cleanTerm, category, sub_type, 90);
      closeModal('learnTermModal');
      
      TTS.speak(`Oke, sudah dicatat. ${cleanTerm} adalah ${category}.`, 'id');
      resolve();
    };
    
    // Attach handler
    const saveBtn = document.getElementById('learnTermSaveBtn');
    saveBtn.onclick = onSave;
  });
}

// ============ AUTH FUNCTIONS ============
async function signUpUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    currentUser = data.user;
    showToast('✅ Akun dibuat! Cek email untuk verifikasi.');
    return true;
  } catch (err) {
    showToast(`❌ ${err.message}`);
    return false;
  }
}

async function signInUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    currentUser = data.user;
    await Memory.load(); // Load glossary setelah login
    showToast('✅ Login berhasil!');
    return true;
  } catch (err) {
    showToast(`❌ Login gagal: ${err.message}`);
    return false;
  }
}

async function signOutUser() {
  try {
    await supabase.auth.signOut();
    currentUser = null;
    Memory.glossary = {};
    showToast('✅ Logout berhasil');
  } catch (err) {
    showToast(`❌ ${err.message}`);
  }
}

// ============ AUTO-INIT ============
window.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  if (currentUser) {
    await Memory.load();
  }
});
