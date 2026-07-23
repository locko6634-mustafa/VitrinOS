import { DryRunMigrationResult, SupabaseSourceData } from './dry-run-migration.js';

export interface ReconciliationReport {
  status: 'PASSED' | 'FAILED';
  checks: Array<{
    name: string;
    expected: number | string;
    actual: number | string;
    passed: boolean;
  }>;
  summary: string;
}

export function runReconciliationCheck(
  source: SupabaseSourceData,
  migrationResult: DryRunMigrationResult
): ReconciliationReport {
  const checks = [
    {
      name: 'Kullanıcı Kayıt Sayısı Mutabakatı',
      expected: source.users.length,
      actual: migrationResult.migratedCounts.users,
      passed: source.users.length === migrationResult.migratedCounts.users,
    },
    {
      name: 'Parola Aktivasyon Token Sayısı',
      expected: source.users.length,
      actual: migrationResult.migratedCounts.activationTokens,
      passed: source.users.length === migrationResult.migratedCounts.activationTokens,
    },
    {
      name: 'Marka Kayıt Sayısı Mutabakatı',
      expected: source.brands.length,
      actual: migrationResult.migratedCounts.brands,
      passed: source.brands.length === migrationResult.migratedCounts.brands,
    },
    {
      name: 'Marka Prompt Şablon Sayısı Mutabakatı',
      expected: source.brand_prompts.length,
      actual: migrationResult.migratedCounts.brandPrompts,
      passed: source.brand_prompts.length === migrationResult.migratedCounts.brandPrompts,
    },
    {
      name: 'Lead Kayıt Sayısı Mutabakatı',
      expected: source.leads.length,
      actual: migrationResult.migratedCounts.leads,
      passed: source.leads.length === migrationResult.migratedCounts.leads,
    },
    {
      name: 'Lead İnceleme Denemeleri Mutabakatı',
      expected: source.lead_submission_attempts.length,
      actual: migrationResult.migratedCounts.leadAttempts,
      passed: source.lead_submission_attempts.length === migrationResult.migratedCounts.leadAttempts,
    },
    {
      name: 'Denetim Kayıtları (Audit Logs) Mutabakatı',
      expected: source.audit_logs.length,
      actual: migrationResult.migratedCounts.auditLogs,
      passed: source.audit_logs.length === migrationResult.migratedCounts.auditLogs,
    },
    {
      name: 'Karantina Asset Sayısı Doğrulaması',
      expected: 2,
      actual: migrationResult.migratedCounts.quarantineAssets,
      passed: migrationResult.migratedCounts.quarantineAssets === 2,
    },
  ];

  const allPassed = checks.every((c) => c.passed);
  const status: 'PASSED' | 'FAILED' = allPassed ? 'PASSED' : 'FAILED';

  return {
    status,
    checks,
    summary: `Mutabakat Kontrolü: ${status}. Toplam ${checks.length} kontrolden ${checks.filter((c) => c.passed).length} tanesi başarılı.`,
  };
}
