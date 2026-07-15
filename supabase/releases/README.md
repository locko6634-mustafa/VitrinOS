# Edge Function release records

Her production Edge Function dağıtımından sonra bu klasöre tarihli bir JSON manifest eklenir.
Manifest; Git commit'ini, doğrulanan Supabase function sürümünü, `verify_jwt` ayarını, Supabase'in bundle SHA-256 değerini ve repodaki kaynak dosyanın SHA-256 değerini birlikte saklar.

`bundle_sha256`, Supabase tarafından üretilen dağıtım paketi özeti; `source_sha256` ise ilgili commit'teki `index.ts` dosyasının özeti olduğundan birbirleriyle aynı olması beklenmez.
