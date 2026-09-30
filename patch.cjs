#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
const srcDir = path.join(root, 'src');

const PATCHES = [
  {
    file: 'components/layout/MainLayout.tsx',
    ops: [
      {
        name: 'remove IconSidebarQuickStart import',
        find: '  IconSidebarQuickStart,\n',
      },
      {
        name: 'remove sponsor import',
        find: "import { APIKEY_FUN_DISPLAY_NAME, hasApiKeyFunConfig } from '@/features/providers/sponsor';\n",
      },
      {
        name: 'remove sidebarIcons.quickStart entry',
        find: '  quickStart: <IconSidebarQuickStart size={18} />,\n',
      },
      {
        name: 'remove isApiKeyFunConfigured + quickStartNavItem block',
        find: [
          '  const isApiKeyFunConfigured = hasApiKeyFunConfig(config);',
          '  const quickStartNavItem: SidebarNavLinkItem = {',
          "    path: '/quick-start',",
          '    label: isApiKeyFunConfigured ? APIKEY_FUN_DISPLAY_NAME : undefined,',
          "    labelKey: isApiKeyFunConfigured ? undefined : 'nav.quick_start',",
          "    metaKey: 'nav_meta.quick_start',",
          '    icon: sidebarIcons.quickStart,',
          '  };',
          '',
        ].join('\n'),
      },
      {
        name: 'remove operate-group quickStartNavItem injection',
        find: '        ...(!isApiKeyFunConfigured ? [quickStartNavItem] : []),\n',
      },
      {
        name: 'remove gateway-group quickStartNavItem injection',
        find: '        ...(isApiKeyFunConfigured ? [quickStartNavItem] : []),\n',
      },
      {
        name: 'remove now-unused config variable',
        find: '  const config = useConfigStore((state) => state.config);\n',
      },
    ],
  },
  {
    // Upstream moved/rewrote DashboardPage in v1.19+. Keep the old ops so
    // patching an older tag still works; on newer versions they simply skip.
    file: ['pages/DashboardPage.tsx', 'features/dashboard/DashboardPage.tsx'],
    ops: [
      {
        name: 'remove IconSidebarQuickStart import',
        find: '  IconSidebarQuickStart,\n',
      },
      {
        name: 'remove hasApiKeyFunConfig import',
        find: "import { hasApiKeyFunConfig } from '@/features/providers/sponsor';\n",
      },
      {
        name: 'remove isApiKeyFunConfigured variable',
        find: '  const isApiKeyFunConfigured = hasApiKeyFunConfig(config);\n',
      },
      {
        name: 'remove quick_start dashboard card',
        find: [
          '    ...(!isApiKeyFunConfigured',
          '      ? [',
          '          {',
          "            label: t('dashboard.quick_start_card'),",
          "            value: t('dashboard.quick_start_entry'),",
          '            icon: <IconSidebarQuickStart size={24} />,',
          "            path: '/quick-start',",
          "            sublabel: t('dashboard.quick_start_entry_desc'),",
          '          },',
          '        ]',
          '      : []),',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    // New in upstream v1.19+: "Quick Fill" section in AI Providers page.
    // It exposes sponsor brands (code0/fennoAI/qiniuCloud/claudeApi) as a
    // dedicated card. We hide the whole card AND keep those brands out of the
    // regular provider list. Older tags do not have this section, so ops skip.
    //
    // Upstream keeps adding sponsor brands to QUICK_FILL_BRAND_ORDER (lmuAI in
    // v1.21). Instead of matching the exact list, we regex-capture whatever
    // brands are listed and reuse them verbatim in the hidden set, so the patch
    // survives future additions without rework.
    file: 'features/providers/components/ProviderCategoryList.tsx',
    ops: [
      {
        name: 'rename quick-fill set to hidden-provider set',
        regex:
          /const QUICK_FILL_BRAND_ORDER: readonly ProviderBrand\[\] = \[([\s\S]*?)\];\s*const QUICK_FILL_BRANDS: ReadonlySet<ProviderBrand> = new Set\(QUICK_FILL_BRAND_ORDER\);/,
        replace: (_match, brands) =>
          `const HIDDEN_PROVIDER_BRANDS: ReadonlySet<ProviderBrand> = new Set([${brands}]);`,
      },
      {
        name: 'remove quickFillGroups variable and hide brands from providerGroups',
        find: [
          '  const quickFillGroups = groups',
          '    .filter((g) => QUICK_FILL_BRANDS.has(g.id))',
          '    .sort(',
          '      (left, right) =>',
          '        QUICK_FILL_BRAND_ORDER.indexOf(left.id) - QUICK_FILL_BRAND_ORDER.indexOf(right.id)',
          '    );',
          '  const providerGroups = groups.filter((g) => !QUICK_FILL_BRANDS.has(g.id));',
        ].join('\n'),
        replace: '  const providerGroups = groups.filter((g) => !HIDDEN_PROVIDER_BRANDS.has(g.id));',
      },
      {
        name: 'remove quickFill aside render block',
        find: [
          '      {quickFillGroups.length > 0 && (',
          '        <aside className={styles.aside}>',
          "          <p className={styles.eyebrow}>{t('providersPage.categories.quickFill')}</p>",
          '          {renderGroups(quickFillGroups)}',
          '        </aside>',
          '      )}',
        ].join('\n'),
      },
    ],
  },
  {
    // New in upstream v1.20+/v1.21: a dedicated /quick-start route renders the
    // sponsor "Quick Start" registration panel (SponsorQuickStartPanel) for
    // APIKEY.FUN. The MainLayout sidebar entry is removed above, so the only
    // remaining entrance is this route. Since the tool only hides entrances
    // (not functionality), we point it at /ai-providers instead of rendering
    // the sponsor page. Older tags that lack these lines simply skip.
    file: 'router/MainRoutes.tsx',
    ops: [
      {
        name: 'redirect /quick-start to /ai-providers',
        find: [
          "  { path: '/quick-start', element: <ProvidersWorkbenchPage fixedBrand=\"apikeyFun\" /> },",
          "  { path: '/quick-start/*', element: <Navigate to=\"/quick-start\" replace /> },",
        ].join('\n'),
        replace: "  { path: '/quick-start', element: <Navigate to=\"/ai-providers\" replace /> },",
      },
    ],
  },
  {
    // In upstream v1.18.4+, Kimi OAuth was separated out into a featured card with
    // a special border, blue gradient background, custom button styling, and an affiliate
    // sign-up button. We revert Kimi OAuth to the standard card style alongside
    // all other OAuth providers in the main list. Older tags skip.
    file: ['pages/OAuthPage.tsx', 'features/oauth/OAuthPage.tsx'],
    ops: [
      {
        name: 'revert Kimi OAuth featured card to normal style (v1.18.5+)',
        find: [
          "  const featuredProvider = providerCards.find((provider) => provider.id === 'kimi');",
          "  const otherOAuthProviders = providerCards.filter((provider) => provider.id !== 'kimi');",
          '',
          '  return (',
          '    <div className={styles.container}>',
          "      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>",
          '',
          '      <div className={styles.content}>',
          '        {featuredProvider && (',
          '          <section className={styles.providerSection}>',
          '            {renderOAuthProviderCard(featuredProvider, true)}',
          '          </section>',
          '        )}',
          '',
          '        <section className={styles.providerSection}>',
          '          <div className={styles.providerList}>',
          '            {otherOAuthProviders.map((provider) => renderOAuthProviderCard(provider))}',
        ].join('\n'),
        replace: [
          '  return (',
          '    <div className={styles.container}>',
          "      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>",
          '',
          '      <div className={styles.content}>',
          '        <section className={styles.providerSection}>',
          '          <div className={styles.providerList}>',
          '            {providerCards.map((provider) => renderOAuthProviderCard(provider))}',
        ].join('\n'),
      },
      {
        name: 'revert Kimi OAuth featured card to normal style (v1.18.4)',
        find: [
          "  const featuredProvider = providerCards.find((provider) => provider.id === 'kimi');",
          "  const otherOAuthProviders = providerCards.filter((provider) => provider.id !== 'kimi');",
          '',
          '  return (',
          '    <div className={styles.container}>',
          "      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>",
          '',
          '      <div className={styles.content}>',
          '        {featuredProvider && (',
          '          <section className={styles.providerSection}>',
          "            <h2 className={styles.sectionTitle}>{t('auth_login.recommended_provider_section')}</h2>",
          '            {renderOAuthProviderCard(featuredProvider, true)}',
          '          </section>',
          '        )}',
          '',
          '        <section className={styles.providerSection}>',
          "          <h2 className={styles.sectionTitle}>{t('auth_login.other_oauth_providers')}</h2>",
          '          <div className={styles.providerList}>',
          '            {otherOAuthProviders.map((provider) => renderOAuthProviderCard(provider))}',
        ].join('\n'),
        replace: [
          '  return (',
          '    <div className={styles.container}>',
          "      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>",
          '',
          '      <div className={styles.content}>',
          '        <section className={styles.providerSection}>',
          '          <div className={styles.providerList}>',
          '            {providerCards.map((provider) => renderOAuthProviderCard(provider))}',
        ].join('\n'),
      },
      {
        // Upstream v1.24 split the featured Kimi card into two providers (kimi and
        // kimi-ai) and drove the special styling through a `featuredProviders` array
        // rendered as its own section. Collapse both back into the single provider
        // list, so neither Kimi card receives the featured treatment (border, gradient
        // and affiliate sign-up button). Older tags lack this shape and skip here.
        name: 'revert Kimi OAuth featured cards to normal style (v1.24+)',
        find: [
          '  const featuredProviders = providerCards.filter((provider) =>',
          "    ['kimi', 'kimi-ai'].includes(provider.id)",
          '  );',
          '  const otherOAuthProviders = providerCards.filter(',
          "    (provider) => !['kimi', 'kimi-ai'].includes(provider.id)",
          '  );',
          '',
          '  return (',
          '    <div className={styles.container}>',
          "      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>",
          '',
          '      <div className={styles.content}>',
          '        <section className={styles.providerSection}>',
          '          <div className={styles.providerList}>',
          '            {featuredProviders.map((provider) => renderOAuthProviderCard(provider, true))}',
          '          </div>',
          '        </section>',
          '',
          '        <section className={styles.providerSection}>',
          '          <div className={styles.providerList}>',
          '            {otherOAuthProviders.map((provider) => renderOAuthProviderCard(provider))}',
          '          </div>',
          '        </section>',
        ].join('\n'),
        replace: [
          '  return (',
          '    <div className={styles.container}>',
          "      <h1 className={styles.pageTitle}>{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>",
          '',
          '      <div className={styles.content}>',
          '        <section className={styles.providerSection}>',
          '          <div className={styles.providerList}>',
          '            {providerCards.map((provider) => renderOAuthProviderCard(provider))}',
          '          </div>',
          '        </section>',
        ].join('\n'),
      },
    ],
  },
  {
    // Ordering, not sponsor-hiding: upstream lists Codex OAuth after meta/kimi, but
    // the common workflow wants it first. Rotate the built-in provider list so Codex
    // leads and every card that used to sit above it wraps around to the end. Plugin
    // providers stay last, where upstream appends them.
    //
    // The providerCards memo is byte-identical from v1.17.2 through v1.24.2, so hooking
    // it absorbs future provider additions: a card inserted before Codex rotates to the
    // end by itself, one inserted after keeps its relative order. The op is `required`,
    // so if upstream ever rewrites this memo the patch fails loudly instead of silently
    // shipping upstream's order.
    file: ['pages/OAuthPage.tsx', 'features/oauth/OAuthPage.tsx'],
    ops: [
      {
        name: 'render Codex OAuth card first',
        required: true,
        regex:
          /const providerCards = useMemo<OAuthProviderCard\[\]>\(\s*\(\) => \[\.\.\.PROVIDERS, \.\.\.pluginProviders\],\s*\[pluginProviders\]\s*\);/,
        replace: [
          'const providerCards = useMemo<OAuthProviderCard[]>(() => {',
          "    const codexIndex = PROVIDERS.findIndex((provider) => provider.id === 'codex');",
          '    const orderedProviders =',
          '      codexIndex > 0',
          '        ? [...PROVIDERS.slice(codexIndex), ...PROVIDERS.slice(0, codexIndex)]',
          '        : PROVIDERS;',
          '    return [...orderedProviders, ...pluginProviders];',
          '  }, [pluginProviders]);',
        ].join('\n'),
      },
    ],
  },
];

const VERIFY_PATTERNS = [
  'quickStartNavItem',
  'isApiKeyFunConfigured',
  'IconSidebarQuickStart',
  'QUICK_FILL_BRANDS',
  'quickFillGroups',
  "providersPage.categories.quickFill",
  'fixedBrand="apikeyFun"',
  'featuredProvider',
];

let totalOps = 0;
let applied = 0;
let skipped = 0;
let missing = 0;
let errored = 0;

for (const { file, ops } of PATCHES) {
  const candidateFiles = Array.isArray(file) ? file : [file];
  const existingFile = candidateFiles.find((f) => fs.existsSync(path.join(srcDir, f)));
  const filePath = existingFile ? path.join(srcDir, existingFile) : path.join(srcDir, candidateFiles[0]);
  totalOps += ops.length;

  if (!existingFile) {
    console.error(`[ERROR] File not found: ${filePath}`);
    errored += ops.length;
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let content = original;
  console.log(`\n--- ${existingFile} --- (line ending: ${eol === '\r\n' ? 'CRLF' : 'LF'})`);

  for (const { name, find, regex, replace, required } of ops) {
    if (regex instanceof RegExp) {
      const before = content;
      content =
        typeof replace === 'function'
          ? before.replace(regex, replace)
          : before.replace(regex, (replace ?? '').replace(/\n/g, eol));
      if (content !== before) {
        applied++;
        console.log(`  [APPLIED] ${name}`);
      } else if (required) {
        missing++;
        console.error(`  [MISSING] ${name} (required op did not match)`);
      } else {
        skipped++;
        console.log(`  [SKIP]    ${name} (pattern not found)`);
      }
      continue;
    }
    const findNorm = find.replace(/\n/g, eol);
    const replaceNorm = replace === undefined ? '' : replace.replace(/\n/g, eol);
    if (content.includes(findNorm)) {
      content = content.replace(findNorm, replaceNorm);
      applied++;
      console.log(`  [APPLIED] ${name}`);
    } else if (required) {
      missing++;
      console.error(`  [MISSING] ${name} (required op did not match)`);
    } else {
      skipped++;
      console.log(`  [SKIP]    ${name} (pattern not found)`);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
  }
}

console.log('\n--- Verification ---');
let verifyFailed = false;
for (const { file } of PATCHES) {
  const candidateFiles = Array.isArray(file) ? file : [file];
  for (const candidate of candidateFiles) {
    const filePath = path.join(srcDir, candidate);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of VERIFY_PATTERNS) {
      if (content.includes(pattern)) {
        console.error(`  [FAIL] ${candidate} still contains "${pattern}"`);
        verifyFailed = true;
      }
    }
  }
}

if (missing > 0) {
  console.error(`\nVerification FAILED: ${missing} required op(s) did not match.`);
  console.error('Upstream restructured the code these ops depend on. Manual review needed.');
}

if (verifyFailed) {
  console.error('\nVerification FAILED: some references remain after patching.');
  console.error('Upstream code may have changed. Manual review needed.');
}

if (missing > 0 || verifyFailed) {
  process.exit(1);
}

console.log('  [OK] No leftover references found.');

if (applied === 0 && skipped === 0) {
  console.log('\nNo patch operations were executed (file errors).');
  process.exit(1);
}

if (applied === 0) {
  console.log('\nNo changes applied - source appears already clean (upstream may have removed the entries).');
} else {
  console.log(
    `\nPatch complete: ${applied} applied, ${skipped} skipped, ${missing} required-missing, ${errored} errored.`
  );
}

process.exit(errored > 0 ? 1 : 0);
