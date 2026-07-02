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
    file: 'pages/DashboardPage.tsx',
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
];

const VERIFY_PATTERNS = [
  'quickStartNavItem',
  'isApiKeyFunConfigured',
  'IconSidebarQuickStart',
];

let totalOps = 0;
let applied = 0;
let skipped = 0;
let errored = 0;

for (const { file, ops } of PATCHES) {
  const filePath = path.join(srcDir, file);
  totalOps += ops.length;

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] File not found: ${filePath}`);
    errored += ops.length;
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let content = original;
  console.log(`\n--- ${file} --- (line ending: ${eol === '\r\n' ? 'CRLF' : 'LF'})`);

  for (const { name, find } of ops) {
    const findNorm = find.replace(/\n/g, eol);
    if (content.includes(findNorm)) {
      content = content.replace(findNorm, '');
      applied++;
      console.log(`  [APPLIED] ${name}`);
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
  const filePath = path.join(srcDir, file);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of VERIFY_PATTERNS) {
    if (content.includes(pattern)) {
      console.error(`  [FAIL] ${file} still contains "${pattern}"`);
      verifyFailed = true;
    }
  }
}

if (verifyFailed) {
  console.error('\nVerification FAILED: some references remain after patching.');
  console.error('Upstream code may have changed. Manual review needed.');
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
  console.log(`\nPatch complete: ${applied} applied, ${skipped} skipped, ${errored} errored.`);
}

process.exit(errored > 0 ? 1 : 0);
