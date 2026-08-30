// 模範解答 for 23.9 課題23.9: アップロードファイルの受け入れ判定を破って塞ぐ (★★★)
// 本文 23.26 の「申告された種別は信用できない」「展開しながら数える」「配信時の防御」を
// 動くコードとして示す。
//
// 安全上の注意: ここで使う検体はすべて無害なバイト列であり、実際のマルウェアを含まない。
//               バイト列はプロセス外へ書き出さない。

export const MIB = 1024 * 1024;

export type Mode = 'naive' | 'strict';

// ---------------------------------------------------------------------------
// 1. マジックバイトによる種別判定
// ---------------------------------------------------------------------------

type Signature = { type: string; offset: number; magic: readonly number[] };

export const SIGNATURES: readonly Signature[] = [
  { type: 'image/png', offset: 0, magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', offset: 0, magic: [0xff, 0xd8, 0xff] },
  { type: 'image/gif', offset: 0, magic: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
  { type: 'application/pdf', offset: 0, magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { type: 'application/zip', offset: 0, magic: [0x50, 0x4b, 0x03, 0x04] }, // "PK\x03\x04"
];

export const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'application/zip',
]);

/** 種別ごとに、配信時にインライン表示を許すかどうかを固定する。 */
export const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);

export const EXTENSION_OF: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
};

/** 拡張子から種別を当てる素朴な表。naive 側だけが使う。 */
const EXTENSION_TYPES: ReadonlyArray<readonly [string, string]> = [
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'],
  ['pdf', 'application/pdf'],
  ['zip', 'application/zip'],
];

/** 実体の先頭バイト列から種別を判定する。判定できなければ null。 */
export function sniffType(head: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    const end = signature.offset + signature.magic.length;
    if (head.byteLength < end) continue;
    let matched = true;
    for (let i = 0; i < signature.magic.length; i += 1) {
      if (head[signature.offset + i] !== signature.magic[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return signature.type;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. 検体
// ---------------------------------------------------------------------------

export type Archive = {
  /** 圧縮後のバイト数 */
  compressedBytes: number;
  /** アーカイブのヘッダが自称する展開後サイズ。攻撃者が自由に書ける値 */
  declaredExpandedBytes: number;
  entries: ReadonlyArray<{ name: string; expandedBytes: number }>;
};

export type Upload = {
  id: string;
  filename: string;
  declaredType: string;
  bytes: Uint8Array;
  archive?: Archive;
};

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));
const build = (...parts: Array<number[] | Uint8Array>): Uint8Array => {
  const flat: number[] = [];
  for (const part of parts) for (const byte of part) flat.push(byte);
  return Uint8Array.from(flat);
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const FIXTURES = {
  limits: {
    maxUploadBytes: 8 * MIB,
    maxExpandedBytes: 64 * MIB,
    maxRatio: 40,
    maxEntries: 2_000,
    maxDepth: 2,
    blockBytes: MIB,
  },
  /** V1: GIF ヘッダで始まる HTML を image/png と申告する */
  magicMismatch: {
    id: 'S1',
    filename: 'avatar.png',
    declaredType: 'image/png',
    bytes: build(ascii('GIF89a'), ascii('<html><script>alert(1)</script></html>')),
  } satisfies Upload,
  /** V2: SVG を .pdf.svg という名前で、application/pdf と申告する */
  doubleExtension: {
    id: 'S2',
    filename: 'logo.pdf.svg',
    declaredType: 'application/pdf',
    bytes: build(ascii('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')),
  } satisfies Upload,
  /** V3: 展開後サイズを小さく自称する擬似アーカイブ */
  zipBomb: {
    id: 'S3',
    filename: 'report.zip',
    declaredType: 'application/zip',
    bytes: build([0x50, 0x4b, 0x03, 0x04], ascii('----compressed-payload----')),
    archive: {
      compressedBytes: 512 * 1024,
      declaredExpandedBytes: 1 * MIB,
      entries: [{ name: 'payload.bin', expandedBytes: 256 * MIB }],
    },
  } satisfies Upload,
  /** V4: 正当な PNG。受理はされるが、配信ヘッダが足りない */
  benignPng: {
    id: 'S4',
    filename: '請求書.png',
    declaredType: 'image/png',
    bytes: build(PNG_MAGIC, ascii('IHDR....benign image body....IEND')),
  } satisfies Upload,
} as const;

// ---------------------------------------------------------------------------
// 3. 受け入れ判定
// ---------------------------------------------------------------------------

export type Decision =
  | { ok: true; type: string; extension: string }
  | { ok: false; reason: string };

export type Gate = {
  mode: Mode;
  accept(upload: Upload): Decision;
};

function naiveTypeOf(filename: string, declaredType: string): string | null {
  const lower = filename.toLowerCase();
  // 誤り: 名前のどこかに既知の拡張子が現れれば、それを種別とみなす。
  //       `logo.pdf.svg` は `.pdf` に当たって PDF と判定される。
  for (const [extension, type] of EXTENSION_TYPES) {
    if (lower.includes(`.${extension}`)) return type;
  }
  return ALLOWED_TYPES.has(declaredType) ? declaredType : null;
}

export const naiveGate: Gate = {
  mode: 'naive',
  accept(upload) {
    const type = naiveTypeOf(upload.filename, upload.declaredType);
    if (!type) return { ok: false, reason: 'unsupported type' };
    // 誤り: 実体を一切見ていない。宣言された展開後サイズも信じている。
    if (upload.archive && upload.archive.declaredExpandedBytes > FIXTURES.limits.maxExpandedBytes) {
      return { ok: false, reason: 'expanded size limit' };
    }
    const extension = upload.filename.slice(upload.filename.lastIndexOf('.') + 1).toLowerCase();
    return { ok: true, type, extension };
  },
};

export const strictGate: Gate = {
  mode: 'strict',
  accept(upload) {
    const detected = sniffType(upload.bytes);
    // 1. 検出できない種別は受け付けない (許可リスト方式)
    if (!detected || !ALLOWED_TYPES.has(detected)) return { ok: false, reason: 'unsupported type' };
    // 2. 申告と実体の食い違いは、両方が許可種別でも拒否する
    if (detected !== upload.declaredType) return { ok: false, reason: 'declared type mismatch' };
    // 3. 上限
    if (upload.bytes.byteLength > FIXTURES.limits.maxUploadBytes) {
      return { ok: false, reason: 'payload too large' };
    }
    // 4. 展開を伴う形式は、展開しながら数える
    if (upload.archive) {
      const result = expandArchive(upload.archive, FIXTURES.limits, { depth: 1 });
      if (result.aborted) return { ok: false, reason: result.aborted };
    }
    // 5. 拡張子は検出結果から決め直す。クライアント由来の値は使わない
    return { ok: true, type: detected, extension: EXTENSION_OF[detected] ?? 'bin' };
  },
};

// ---------------------------------------------------------------------------
// 4. 展開
// ---------------------------------------------------------------------------

export type Limits = typeof FIXTURES.limits;
export type Expansion = { expanded: number; aborted: string | null };

/**
 * 展開しながらサイズと圧縮比を数える。
 * アーカイブが自称する展開後サイズ (declaredExpandedBytes) は一切参照しない。
 */
export function expandArchive(archive: Archive, limits: Limits, ctx: { depth: number }): Expansion {
  if (ctx.depth > limits.maxDepth) return { expanded: 0, aborted: 'nested archive too deep' };
  if (archive.entries.length > limits.maxEntries) return { expanded: 0, aborted: 'too many entries' };
  const ratioLimit = archive.compressedBytes * limits.maxRatio;
  let expanded = 0;
  for (const entry of archive.entries) {
    let remaining = entry.expandedBytes;
    while (remaining > 0) {
      const block = Math.min(limits.blockBytes, remaining);
      // 書き込む前に判定する。超えた分を書いてから気づくのでは遅い。
      if (expanded + block > limits.maxExpandedBytes) return { expanded, aborted: 'expanded size limit' };
      if (expanded + block > ratioLimit) return { expanded, aborted: 'compression ratio' };
      expanded += block;
      remaining -= block;
    }
  }
  return { expanded, aborted: null };
}

/** naive 側の展開。宣言値だけを見て、あとは全部展開する。 */
export function naiveExpand(archive: Archive): Expansion {
  let expanded = 0;
  for (const entry of archive.entries) expanded += entry.expandedBytes;
  return { expanded, aborted: null };
}

// ---------------------------------------------------------------------------
// 5. 配信ヘッダ
// ---------------------------------------------------------------------------

export const REQUIRED_DELIVERY_HEADERS = [
  'x-content-type-options',
  'content-disposition',
  'content-security-policy',
  'cross-origin-resource-policy',
] as const;

export type StoredFile = { id: string; filename: string; declaredType: string; detectedType: string };

export function deliveryHeaders(file: StoredFile, mode: Mode): Record<string, string> {
  if (mode === 'naive') {
    // 誤り: 申告された種別をそのまま返し、推測を止める指示も付けていない。
    return { 'content-type': file.declaredType };
  }
  const inline = INLINE_TYPES.has(file.detectedType);
  const disposition = inline ? 'inline' : 'attachment';
  return {
    'content-type': file.detectedType,
    'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'",
    'cross-origin-resource-policy': 'same-site',
  };
}

export function missingDeliveryHeaders(headers: Record<string, string>): string[] {
  return REQUIRED_DELIVERY_HEADERS.filter((name) => !(name in headers));
}

// ---------------------------------------------------------------------------
// 6. 4件の再現
// ---------------------------------------------------------------------------

export type Finding = {
  id: 'V1' | 'V2' | 'V3' | 'V4';
  label: string;
  naive: string;
  strict: string;
  reproduced: boolean;
  remains: boolean;
};

const describe = (decision: Decision): string =>
  decision.ok ? `accepted as ${decision.type}` : `rejected: ${decision.reason}`;

export function runFindings(): Finding[] {
  const v1 = { naive: naiveGate.accept(FIXTURES.magicMismatch), strict: strictGate.accept(FIXTURES.magicMismatch) };
  const v2 = { naive: naiveGate.accept(FIXTURES.doubleExtension), strict: strictGate.accept(FIXTURES.doubleExtension) };
  const v3 = {
    naive: naiveExpand(FIXTURES.zipBomb.archive),
    strict: expandArchive(FIXTURES.zipBomb.archive, FIXTURES.limits, { depth: 1 }),
  };
  const stored: StoredFile = {
    id: FIXTURES.benignPng.id,
    filename: FIXTURES.benignPng.filename,
    declaredType: FIXTURES.benignPng.declaredType,
    detectedType: sniffType(FIXTURES.benignPng.bytes) ?? 'application/octet-stream',
  };
  const v4 = {
    naive: missingDeliveryHeaders(deliveryHeaders(stored, 'naive')),
    strict: missingDeliveryHeaders(deliveryHeaders(stored, 'strict')),
  };

  return [
    {
      id: 'V1',
      label: 'magic-mismatch',
      naive: describe(v1.naive),
      strict: describe(v1.strict),
      // 実体が申告と違うのに受理されたら再現。
      reproduced: v1.naive.ok,
      remains: v1.strict.ok,
    },
    {
      id: 'V2',
      label: 'double-extension',
      naive: describe(v2.naive),
      strict: describe(v2.strict),
      reproduced: v2.naive.ok,
      remains: v2.strict.ok,
    },
    {
      id: 'V3',
      label: 'zip-bomb',
      naive: `expanded=${v3.naive.expanded}`,
      strict: `expanded=${v3.strict.expanded} aborted=${v3.strict.aborted ?? 'none'}`,
      reproduced: v3.naive.expanded > FIXTURES.limits.maxExpandedBytes,
      remains: v3.strict.expanded > FIXTURES.limits.maxExpandedBytes,
    },
    {
      id: 'V4',
      label: 'sniffable-delivery',
      naive: `missing=[${v4.naive.join(', ')}]`,
      strict: `missing=[${v4.strict.join(', ')}]`,
      reproduced: v4.naive.length > 0,
      remains: v4.strict.length > 0,
    },
  ];
}

/** 過剰な拒否をしていないことの確認。正当な PNG は strict でも受理される。 */
export function benignAccepted(): boolean {
  return strictGate.accept(FIXTURES.benignPng).ok;
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  const benign = benignAccepted() ? 'benign png still accepted' : 'benign png REJECTED (over-blocking)';
  return [
    `naive gate: ${reproduced}/${findings.length} weaknesses reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / strict ${finding.strict}`),
    `strict gate: ${remaining}/${findings.length} weaknesses remaining (${benign})`,
  ];
}
