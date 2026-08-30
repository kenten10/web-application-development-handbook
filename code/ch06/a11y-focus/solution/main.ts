// Solution for 6.6 課題6.6: フォーカスとエラー通知の欠落を再現して塞ぐ (★★★)
// 本文 6.11 (フォーカス管理) と 7.9 (フォームのアクセシビリティ) の判断を、
// ブラウザを使わずに検証できる最小の文書モデルの上で再現する。
//
// 安全上の注意: ここで扱うのは純粋なデータ構造であり、ネットワークもファイルも触らない。
//               実際のブラウザの挙動をすべて再現するものではない (25.11 の3層のうち自動検査の層に相当する)。

// ---------------------------------------------------------------------------
// 1. 最小の文書モデル
// ---------------------------------------------------------------------------

export type Attrs = Record<string, string>;

export type El = {
  id: string;
  tag: string;
  attrs: Attrs;
  text: string;
  children: El[];
};

export function el(id: string, tag: string, attrs: Attrs = {}, text = '', children: El[] = []): El {
  return { id, tag, attrs, text, children };
}

/** 既定でフォーカス可能な要素。実ブラウザの集合の部分集合である。 */
const NATIVELY_FOCUSABLE = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);

export function walk(root: El): El[] {
  const out: El[] = [root];
  for (const child of root.children) out.push(...walk(child));
  return out;
}

export function find(root: El, id: string): El | null {
  for (const node of walk(root)) if (node.id === id) return node;
  return null;
}

/** 祖先をたどって「無いことにされている」かを判定する。 */
function blockedBy(root: El, target: El, key: 'hidden' | 'inert'): boolean {
  const path = pathTo(root, target.id);
  return path.some((node) => node.attrs[key] === 'true');
}

function pathTo(root: El, id: string, acc: El[] = []): El[] {
  const next = [...acc, root];
  if (root.id === id) return next;
  for (const child of root.children) {
    const found = pathTo(child, id, next);
    if (found.length > 0) return found;
  }
  return [];
}

/**
 * Tab で到達できる要素を文書順に返す。
 * - hidden / inert の配下は外れる
 * - disabled は外れる
 * - tabindex が負の要素は「focus() では移せるが Tab では止まらない」ため外れる
 */
export function tabbables(root: El): El[] {
  return walk(root).filter((node) => {
    if (blockedBy(root, node, 'hidden')) return false;
    if (blockedBy(root, node, 'inert')) return false;
    if (node.attrs['disabled'] === 'true') return false;
    const tabindex = node.attrs['tabindex'];
    if (tabindex !== undefined) return Number(tabindex) >= 0;
    return NATIVELY_FOCUSABLE.has(node.tag);
  });
}

/** focus() で移せるか (Tab で止まるかとは別)。 */
export function focusable(root: El, node: El): boolean {
  if (blockedBy(root, node, 'hidden')) return false;
  if (blockedBy(root, node, 'inert')) return false;
  if (node.attrs['disabled'] === 'true') return false;
  return node.attrs['tabindex'] !== undefined || NATIVELY_FOCUSABLE.has(node.tag);
}

// ---------------------------------------------------------------------------
// 2. アクセシブルな名前 (7.9 の優先順位の縮小版)
// ---------------------------------------------------------------------------

export function accessibleName(root: El, node: El): string {
  const labelledby = node.attrs['aria-labelledby'];
  if (labelledby) {
    const parts = labelledby
      .split(/\s+/)
      .map((id) => find(root, id))
      .filter((found): found is El => found !== null)
      .map((found) => textOf(found));
    if (parts.join(' ').trim() !== '') return parts.join(' ').trim();
  }
  const label = node.attrs['aria-label'];
  if (label !== undefined && label.trim() !== '') return label.trim();
  const explicit = walk(root).find((candidate) => candidate.tag === 'label' && candidate.attrs['for'] === node.id);
  if (explicit) return textOf(explicit);
  if (node.tag !== 'input' && textOf(node) !== '') return textOf(node);
  // placeholder は名前として数えない。入力を始めると消えるためである。
  return '';
}

export function textOf(node: El): string {
  return [node.text, ...node.children.map((child) => textOf(child))].join('').trim();
}

/** aria-describedby でつながっている説明文をすべて集める。 */
export function describedBy(root: El, node: El): string[] {
  const ids = (node.attrs['aria-describedby'] ?? '').split(/\s+/).filter((id) => id !== '');
  return ids.map((id) => find(root, id)).filter((found): found is El => found !== null).map((found) => textOf(found));
}

// ---------------------------------------------------------------------------
// 3. 画面
// ---------------------------------------------------------------------------

export type Screen = {
  root: El;
  activeId: string | null;
  /** ライブリージョンへ書き込まれた文字列の履歴。 */
  announced: string[];
};

export function buildScreen(): Screen {
  const root = el('root', 'body', {}, '', [
    el('page', 'main', {}, '', [
      el('page-title', 'h1', {}, 'タスク一覧'),
      // 領域は先に存在させておく (7.9)。あとから挿入すると通知されないことがある。
      el('live', 'div', { 'aria-live': 'polite' }, ''),
      el('list', 'ul', {}, '', [
        el('item-1', 'li', {}, '', [el('del-1', 'button', {}, '削除')]),
        el('item-2', 'li', {}, '', [el('del-2', 'button', {}, '削除')]),
        el('item-3', 'li', {}, '', [el('del-3', 'button', {}, '削除')]),
      ]),
      el('signup', 'form', {}, '', [
        el('label-email', 'label', { for: 'email' }, 'メールアドレス'),
        el('email', 'input', { type: 'email', placeholder: 'you@example.com', required: 'true' }),
        el('email-help', 'p', {}, '確認メールの宛先になる。'),
        el('submit', 'button', { type: 'submit' }, '送信'),
      ]),
    ]),
    el('dialog', 'div', { role: 'dialog', 'aria-modal': 'true', hidden: 'true', 'aria-labelledby': 'dialog-title' }, '', [
      el('dialog-title', 'h2', {}, 'このタスクを削除しますか'),
      el('confirm', 'button', {}, '削除する'),
      el('cancel', 'button', {}, 'やめる'),
    ]),
  ]);
  return { root, activeId: null, announced: [] };
}

export function announce(screen: Screen, message: string): void {
  const live = find(screen.root, 'live');
  if (!live) return;
  // 同じ文字列を再設定しても変化が無いため通知されない (7.9)。件数を含めて差を作る。
  live.text = message;
  screen.announced.push(message);
}

/** 支援技術へ届きうる文字列。フォーカス先の名前と説明、そしてライブリージョンの内容。 */
export function reachable(screen: Screen): string[] {
  const out: string[] = [...screen.announced];
  if (screen.activeId) {
    const node = find(screen.root, screen.activeId);
    if (node) {
      out.push(accessibleName(screen.root, node));
      out.push(...describedBy(screen.root, node));
      // 入れ物へフォーカスを移した場合は、その中身が読み進める位置になる
      if (node.children.length > 0) out.push(textOf(node));
    }
  }
  return out.filter((value) => value !== '');
}

// ---------------------------------------------------------------------------
// 4. モーダル ― 4つの動作 (6.11)
// ---------------------------------------------------------------------------

export type Dialog = {
  open: (screen: Screen) => void;
  close: (screen: Screen) => void;
  tab: (screen: Screen, shift?: boolean) => void;
};

function setAttr(screen: Screen, id: string, key: string, value: string | null): void {
  const node = find(screen.root, id);
  if (!node) return;
  if (value === null) delete node.attrs[key];
  else node.attrs[key] = value;
}

function moveNext(screen: Screen, shift: boolean): void {
  const order = tabbables(screen.root);
  if (order.length === 0) {
    screen.activeId = null;
    return;
  }
  const index = order.findIndex((node) => node.id === screen.activeId);
  if (index < 0) {
    screen.activeId = (shift ? order[order.length - 1] : order[0])!.id;
    return;
  }
  const next = shift ? (index - 1 + order.length) % order.length : (index + 1) % order.length;
  screen.activeId = order[next]!.id;
}

/**
 * よくある誤り。属性で「モーダルである」と宣言するが、
 * フォーカスの移動・閉じ込め・復帰のいずれも行わない。
 */
export const naiveDialog: Dialog = {
  open(screen) {
    setAttr(screen, 'dialog', 'hidden', 'false');
    // 背後を aria-hidden にするだけ。フォーカスは外れない (6.11)
    setAttr(screen, 'page', 'aria-hidden', 'true');
  },
  close(screen) {
    setAttr(screen, 'dialog', 'hidden', 'true');
    setAttr(screen, 'page', 'aria-hidden', null);
    screen.activeId = null; // body へ落ちる
  },
  tab(screen, shift = false) {
    moveNext(screen, shift);
  },
};

const returnTo = new WeakMap<Screen, string | null>();

export const fixedDialog: Dialog = {
  open(screen) {
    // 1. 戻り先を記憶する
    returnTo.set(screen, screen.activeId);
    setAttr(screen, 'dialog', 'hidden', 'false');
    // 3. 背後を inert にする。aria-hidden だけでは Tab が抜ける
    setAttr(screen, 'page', 'inert', 'true');
    setAttr(screen, 'page', 'aria-hidden', 'true');
    // 2. 中へ移す
    const inside = tabbables(find(screen.root, 'dialog')!);
    screen.activeId = inside[0]?.id ?? 'dialog-title';
  },
  close(screen) {
    setAttr(screen, 'dialog', 'hidden', 'true');
    setAttr(screen, 'page', 'inert', null);
    setAttr(screen, 'page', 'aria-hidden', null);
    // 4. 戻す。消えていたら代替の移動先へ
    const wanted = returnTo.get(screen) ?? null;
    const node = wanted ? find(screen.root, wanted) : null;
    if (node && focusable(screen.root, node)) {
      screen.activeId = node.id;
    } else {
      setAttr(screen, 'page-title', 'tabindex', '-1');
      screen.activeId = 'page-title';
    }
    returnTo.delete(screen);
  },
  tab(screen, shift = false) {
    // 背後が inert なので、tabbables はダイアログ内だけになり自然に巡回する
    moveNext(screen, shift);
  },
};

export function deleteItem(screen: Screen, itemId: string): void {
  const list = find(screen.root, 'list');
  if (!list) return;
  list.children = list.children.filter((child) => child.id !== itemId);
}

// ---------------------------------------------------------------------------
// 5. フォーム ― エラーの3経路 (7.9)
// ---------------------------------------------------------------------------

export type SubmitResult = { errors: Record<string, string>; ok: boolean };

export type Form = { submit: (screen: Screen, values: Record<string, string>) => SubmitResult };

function validate(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = values['email'] ?? '';
  if (email === '') errors['email'] = 'メールアドレスを入力してください。';
  else if (!email.includes('@')) errors['email'] = 'メールアドレスは @ を含む必要があります。';
  return errors;
}

function clearErrorNodes(screen: Screen): void {
  const form = find(screen.root, 'signup');
  if (!form) return;
  form.children = form.children.filter((child) => child.id !== 'email-error' && child.id !== 'error-summary');
  const input = find(screen.root, 'email');
  if (input) {
    delete input.attrs['aria-invalid'];
    input.attrs['aria-describedby'] = 'email-help';
  }
}

/** よくある誤り。エラーを描画するだけで、どの経路にも載せない。 */
export const naiveForm: Form = {
  submit(screen, values) {
    clearErrorNodes(screen);
    const errors = validate(values);
    const form = find(screen.root, 'signup');
    if (form && errors['email']) {
      // 画面には出る。しかし入力欄と結び付いておらず、通知もされない
      form.children.push(el('email-error', 'p', { class: 'error' }, errors['email']));
    }
    screen.activeId = 'submit'; // 押したボタンのまま
    return { errors, ok: Object.keys(errors).length === 0 };
  },
};

export const fixedForm: Form = {
  submit(screen, values) {
    clearErrorNodes(screen);
    const errors = validate(values);
    const form = find(screen.root, 'signup');
    const input = find(screen.root, 'email');
    const entries = Object.entries(errors);

    if (entries.length === 0) {
      screen.activeId = 'submit';
      announce(screen, '送信しました。確認メールを送信済みです。');
      return { errors, ok: true };
    }

    if (form && input) {
      // 経路1: フィールド単位
      form.children.push(el('email-error', 'p', { role: 'group' }, errors['email'] ?? ''));
      input.attrs['aria-invalid'] = 'true';
      input.attrs['aria-describedby'] = 'email-help email-error';
      // 経路2: まとめ。件数を見出しに含め、各項目から該当欄へ戻れるようにする
      const summary = el('error-summary', 'div', { tabindex: '-1', 'aria-labelledby': 'error-summary-title' }, '', [
        el('error-summary-title', 'h2', {}, `入力内容に${entries.length}件の問題があります`),
        ...entries.map(([field, message]) => el(`summary-${field}`, 'a', { href: `#${field}` }, message)),
      ]);
      form.children.unshift(summary);
      // 経路3: 通知。ここではサマリへフォーカスを移すことで確実に届ける
      screen.activeId = 'error-summary';
    }
    return { errors, ok: false };
  },
};

// ---------------------------------------------------------------------------
// 6. 検査
// ---------------------------------------------------------------------------

export type Finding = {
  id: string;
  label: string;
  naive: string;
  fixed: string;
  reproduced: boolean;
  remains: boolean;
};

function idsInDialog(screen: Screen): Set<string> {
  const dialog = find(screen.root, 'dialog');
  return new Set(dialog ? walk(dialog).map((node) => node.id) : []);
}

function openFrom(dialog: Dialog, triggerId: string): Screen {
  const screen = buildScreen();
  screen.activeId = triggerId;
  dialog.open(screen);
  return screen;
}

/** A1: 開いた直後にフォーカスがダイアログの中にあるか。 */
function focusAfterOpen(dialog: Dialog): { screen: Screen; inside: boolean } {
  const screen = openFrom(dialog, 'del-2');
  const inside = screen.activeId !== null && idsInDialog(screen).has(screen.activeId);
  return { screen, inside };
}

/** A2: Tab を押し続けたときに、ダイアログの外へ出るか。 */
function escapedIds(dialog: Dialog): string[] {
  const screen = openFrom(dialog, 'del-2');
  const inDialog = idsInDialog(screen);
  const escaped: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    dialog.tab(screen);
    if (screen.activeId !== null && !inDialog.has(screen.activeId)) escaped.push(screen.activeId);
  }
  return escaped;
}

/** A3: 戻り先が消えている流れで、閉じたあとどこへ戻るか。 */
function focusAfterDelete(dialog: Dialog): string {
  const screen = openFrom(dialog, 'del-2');
  deleteItem(screen, 'item-2');
  dialog.close(screen);
  return screen.activeId ?? '(body)';
}

/** A4: 送信エラーが支援技術へ届く経路に載るか。 */
function errorDelivery(form: Form): { message: string; delivered: boolean } {
  const screen = buildScreen();
  screen.activeId = 'submit';
  const result = form.submit(screen, { email: '' });
  const message = result.errors['email'] ?? '';
  const heard = reachable(screen).join(' | ');
  return { message, delivered: message !== '' && heard.includes(message) };
}

export function runFindings(): Finding[] {
  const a1 = { naive: focusAfterOpen(naiveDialog), fixed: focusAfterOpen(fixedDialog) };
  const a2 = { naive: escapedIds(naiveDialog), fixed: escapedIds(fixedDialog) };
  const a3 = { naive: focusAfterDelete(naiveDialog), fixed: focusAfterDelete(fixedDialog) };
  const a4 = { naive: errorDelivery(naiveForm), fixed: errorDelivery(fixedForm) };

  return [
    {
      id: 'A1',
      label: 'focus-not-moved',
      naive: `focus=${a1.naive.screen.activeId ?? '(body)'} inside-dialog=${a1.naive.inside}`,
      fixed: `focus=${a1.fixed.screen.activeId ?? '(body)'} inside-dialog=${a1.fixed.inside}`,
      reproduced: !a1.naive.inside,
      remains: !a1.fixed.inside,
    },
    {
      id: 'A2',
      label: 'focus-escapes',
      naive: `escaped=${a2.naive.length} first=${a2.naive[0] ?? 'none'}`,
      fixed: `escaped=${a2.fixed.length} first=${a2.fixed[0] ?? 'none'}`,
      reproduced: a2.naive.length > 0,
      remains: a2.fixed.length > 0,
    },
    {
      id: 'A3',
      label: 'focus-not-restored',
      naive: `after-close=${a3.naive}`,
      fixed: `after-close=${a3.fixed}`,
      reproduced: a3.naive === '(body)',
      remains: a3.fixed === '(body)',
    },
    {
      id: 'A4',
      label: 'error-not-announced',
      naive: `delivered=${a4.naive.delivered}`,
      fixed: `delivered=${a4.fixed.delivered}`,
      reproduced: !a4.naive.delivered,
      remains: !a4.fixed.delivered,
    },
  ];
}

/** 過剰な対策をしていないことの確認。正しい入力は素通りし、成功が通知される。 */
export function validSubmitAnnounced(): boolean {
  const screen = buildScreen();
  screen.activeId = 'submit';
  const result = fixedForm.submit(screen, { email: 'user@example.com' });
  return result.ok && screen.announced.length === 1;
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  const benign = validSubmitAnnounced() ? 'valid submit still announced' : 'valid submit BROKEN (over-blocking)';
  return [
    `naive ui: ${reproduced}/${findings.length} barriers reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / fixed ${finding.fixed}`),
    `fixed ui: ${remaining}/${findings.length} barriers remaining (${benign})`,
  ];
}
