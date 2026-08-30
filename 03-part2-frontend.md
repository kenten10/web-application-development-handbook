# 第II部 フロントエンド編

第I部では、URLが入力されてからブラウザがHTML・CSS・JavaScriptを受け取り、画面を構築するまでを追った。そこまで分かると、次の問題が見えてくる。ブラウザはDOMやイベントという低水準の部品を提供するが、状態が変わるたびにどの要素を書き換え、通信結果をどこへ反映し、複数画面で共有する値を誰が管理するかまでは決めてくれない。小さな画面なら手作業で対応できても、機能が増えるほど状態とDOMの同期は壊れやすくなる。

第II部は、この同期問題を段階的に解く。まずJavaScriptの実行モデルと型の境界を固め、次にUI更新を宣言的に扱うフレームワークを導入する。そこから、画面をまたぐ状態とサーバ由来データを整理し、コードを配布可能な形へ変換するビルド工程を経て、最後にCSR (Client-Side Rendering)・SSR (Server-Side Rendering)・SSG (Static Site Generation) など「いつ、どこで画面を作るか」を選べるところまで進む。React、TypeScript、Viteを個別の道具として暗記するのではなく、それぞれが前段のどの困難を引き受けているかをつなげて理解することが、この部の目標である。

---

<a id="chapter-5"></a>
## 第5章 JavaScriptとTypeScriptの中核機構

第4章までで、JavaScriptがイベントループ上でDOM操作や非同期I/Oを実行することは分かった。しかし、同じ処理系を使っていても、変数の寿命、参照の共有、`this`の決まり方、Promiseの実行順を曖昧に理解していると、UI更新以前の段階で不具合が生まれる。フレームワークはこれらの言語仕様を隠すのではなく、その上に成立しているため、土台の誤解は上位層でより見つけにくい問題になる。

本章では、JavaScriptとTypeScriptを「構文の一覧」ではなく、状態・制御・失敗をどう表現する言語なのかという観点から整理する。ここで実行モデルと型の限界を固めることで、第6章では複雑なDOM更新をフレームワークがどのように組み立て直しているかを追えるようになる。

<!-- handbook:chapter-guide:start {"chapter":5} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 非同期バグ、型の思い込み、スコープ汚染、例外握りつぶし、メモリリークを、言語仕様と実行モデルから修正する。
>
> **到達目標**
> - 値渡し、クロージャ、this、等価性を正確に説明できる。
> - Promise、async/await、イベントループの順序を予測できる。
> - TypeScriptの静的保証と実行時検証の境界を説明できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [4.5 JavaScriptランタイムとイベントループ](02-part1-foundations.md#section-4-5) ― JavaScriptランタイムとイベントループ
>
> **中核概念**  
> [5.1 変数とスコープ ― `var`、`let`、`const`](#section-5-1)、[5.2 値型と参照型、等価性](#section-5-2)、[5.3 関数 ― First-class Citizen](#section-5-3)、[5.4 非同期処理の進化](#section-5-4)、[5.7 TypeScript ― 型システムの設計思想](#section-5-7)、[5.9 エラー処理の設計](#section-5-9)
>
> **最小実装**  
> [5.5 自作 Promise の実装](#section-5-5) (発展)、[5.12 実装課題 ― JavaScript と TypeScript の深奥](#section-5-12) (実務選択)
>
> **本番実装との差分**
> - 自作Promiseは教育用であり、thenable同化、種々の静的メソッド、ホスト統合など標準の全挙動を実装していない。TypeScript型も外部入力の正しさを保証しない。
>
> **典型的な失敗**
> - 参照渡しという不正確な説明で変更共有を誤る。
> - 非同期処理の拒否を処理しない。
> - 型アサーションで不整合を隠す。
>
> **診断・デバッグ方法**
> - 最小再現コードで同期処理、マイクロタスク、タイマを順番に記録する。
> - heap snapshotと保持パスでリーク元を調べる。
>
> **意思決定チェックリスト**
> - 実行時検証が必要な境界はどこか。
> - 例外、Result、戻り値のどれで失敗を表現するか。
>
> **演習と評価基準**  
> 対象: [5.12 実装課題 ― JavaScript と TypeScript の深奥](#section-5-12) (実務選択)
> - 非同期実行順を事前に予測し実測と一致させる。
> - 教材Promiseの標準との差分を列挙できる。
>
> **一次資料・発展資料**
> - ECMAScript Language Specification
> - TypeScript Handbook
> - ECMA-402
<!-- handbook:chapter-guide:end -->

<a id="section-5-1"></a>
### 5.1 変数とスコープ ― `var`、`let`、`const`
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"5.1"} -->
JavaScriptの処理を追う最初の条件は、値がどこから見え、いつまで生きるかを把握することだ。イベントコールバックやモジュールが増えるほど、変数の可視範囲を誤ると意図しない共有や上書きが起きる。そこでまず、状態の置き場所を決めるスコープから確認する。

新規コードでは通常`let`と`const`を優先する。ただし、既存コードの保守、関数スコープを意図したコード、古い実行環境との互換性確認では`var`を読む必要がある。違いを整理する。

| | スコープ | 巻き上げ | 再宣言 | 再代入 |
|---|---|---|---|---|
| `var` | 関数 | 値が `undefined` で初期化 | 可 | 可 |
| `let` | ブロック | TDZ※あり | 不可 | 可 |
| `const` | ブロック | TDZあり | 不可 | 不可 |

※TDZ = Temporal Dead Zone。宣言前にアクセスすると `ReferenceError`。

```typescript
console.log(x); // undefined (var は巻き上げで初期化される)
var x = 1;

console.log(y); // ReferenceError (TDZ)
let y = 2;
```

`const` で宣言したオブジェクトの**プロパティ**は変更可能だ。`const` は再代入を禁止するだけで、不変性 (immutability) は保証しない。

```typescript
const obj = { count: 0 };
obj.count = 1;  // OK
obj = {};       // TypeError

// 真に不変にしたい場合
const frozen = Object.freeze({ count: 0 });
frozen.count = 1;  // 厳格モードでエラー、非厳格モードでは黙って失敗
```

<a id="section-5-2"></a>
### 5.2 値型と参照型、等価性
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"5.2"} -->
スコープによって変数が見える範囲は分かったが、変数同士が同じ値を独立に持つのか、同じオブジェクトを共有するのかは別の問題である。状態更新の影響範囲を判断するには、代入と比較が何を扱っているかを区別する必要がある。

JavaScriptのデータは大きく2種類:

- **プリミティブ**: `number`、`string`、`boolean`、`null`、`undefined`、`symbol`、`bigint`
- **オブジェクト**: `object`、`array`、`function`

JavaScriptの代入と引数渡しはいずれも**値渡し**である。オブジェクトの場合、渡される値が「オブジェクトを指す参照」であるため、複数の変数から同じオブジェクトを変更できる。関数内で引数変数そのものを別オブジェクトへ再代入しても、呼び出し元の変数は変わらない [ECMAScript, 2026]。

```typescript
let a = 1;
let b = a;
b = 2;
console.log(a); // 1 (値が複製されている)

let x = { n: 1 };
let y = x;
y.n = 2;
console.log(x.n); // 2 (同じオブジェクトを指している)
```

**等価演算子の罠:**

```typescript
'' == 0           // true (暗黙の型変換)
'' === 0          // false (型まで比較)
null == undefined // true
NaN === NaN       // false (!)
0 === -0          // true
Object.is(NaN, NaN) // true
Object.is(0, -0)    // false
```

実務では `===` を使う。`==` は仕様が複雑で、可読性も低い。`null` チェックには `value == null` (null と undefined の両方にマッチ) という慣用があるが、TypeScript では `value === null || value === undefined` か `value != null` の方が意図が明確だ。

<a id="section-5-3"></a>
### 5.3 関数 ― First-class Citizen
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"C","term":"Closure (クロージャ)"} -->
<!-- handbook:index {"group":"か行","term":"関数型プログラミング"} -->

<!-- handbook:narrative-bridge {"section":"5.3"} -->
値と参照の共有を理解すると、次に処理そのものをどのように受け渡すかが問題になる。JavaScriptでは関数も値であり、状態を閉じ込めたり、後から実行する処理として登録したりできる。この性質がイベント処理やフレームワークの基礎になる。

JavaScriptの関数は値である。変数に代入でき、引数として渡せ、戻り値にもなる。

```typescript
const greet = function(name: string) { return `Hello, ${name}`; };
const arrow = (name: string) => `Hello, ${name}`;
function declared(name: string) { return `Hello, ${name}`; }
```

**アロー関数と `this`:**

アロー関数は**自身の `this` を持たない**。これが普通の関数との最大の違いだ。

```typescript
class Counter {
  count = 0;

  // メソッド内のコールバック
  start() {
    // BAD: 通常関数は外側のthisを捕獲しない
    setInterval(function() {
      // thisは呼び出し方法とホスト環境に依存し、Counterインスタンスではない
      console.log((this as any).count);
    }, 1000);

    // GOOD: アロー関数は外側の this を引き継ぐ
    setInterval(() => {
      console.log(this.count);  // OK
    }, 1000);
  }
}
```

**クロージャ:**

関数は宣言時のスコープにある変数を「捕獲」する。これがJavaScriptの強力な抽象化機構だ。

```typescript
function makeCounter() {
  let count = 0;
  return {
    inc: () => ++count,
    dec: () => --count,
    get: () => count,
  };
}

const c = makeCounter();
c.inc(); c.inc(); c.inc();
console.log(c.get()); // 3
// count は外から触れない (private のような効果)
```

クロージャ自体がメモリリークを起こすわけではない。クロージャを含む関数やイベントリスナーが到達可能なまま残ると、捕獲した大きなオブジェクトも回収されない。長寿命のリスナー、タイマー、キャッシュでは、解除や参照の破棄が必要か確認する。

<a id="section-5-4"></a>
### 5.4 非同期処理の進化
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"P","term":"Polyfill"} -->
<!-- handbook:index {"group":"P","term":"Promise"} -->

<!-- handbook:narrative-bridge {"section":"5.4"} -->
関数を値として渡せるからこそ、完了後に呼ぶ処理をコールバックとして表現できる。しかし、非同期処理が連鎖すると制御の流れと失敗経路がネストへ埋もれる。Promiseとasync/awaitは、この時間的な依存関係を合成可能な形へ変えるために導入された。

JavaScriptの非同期処理は、コールバック → Promise → async/await と進化してきた。

**コールバック地獄:**

```typescript
fs.readFile('a.txt', (err, dataA) => {
  if (err) return handleError(err);
  fs.readFile('b.txt', (err, dataB) => {
    if (err) return handleError(err);
    fs.readFile('c.txt', (err, dataC) => {
      if (err) return handleError(err);
      // ネストが深すぎる
    });
  });
});
```

**Promiseチェーン:**

```typescript
readFile('a.txt')
  .then(dataA => readFile('b.txt'))
  .then(dataB => readFile('c.txt'))
  .then(dataC => process(dataC))
  .catch(handleError);
```

**async/await:**

```typescript
async function run() {
  try {
    const dataA = await readFile('a.txt');
    const dataB = await readFile('b.txt');
    const dataC = await readFile('c.txt');
    return process(dataC);
  } catch (err) {
    handleError(err);
  }
}
```

ただし上記は**直列実行**だ。並列化したい場合:

```typescript
async function runParallel() {
  // 3つのファイル読み込みを同時に開始
  const [dataA, dataB, dataC] = await Promise.all([
    readFile('a.txt'),
    readFile('b.txt'),
    readFile('c.txt'),
  ]);
  return process(dataC);
}
```

**Promise.all のバリエーション:**

| メソッド | 挙動 |
|---|---|
| `Promise.all([p1, p2])` | 全て成功で resolve、1つでも失敗で reject |
| `Promise.allSettled([p1, p2])` | 全て完了 (成功/失敗問わず) で resolve、`status` プロパティで判定 |
| `Promise.race([p1, p2])` | 最初に決着した1つの結果 |
| `Promise.any([p1, p2])` | 最初に成功した1つ、全て失敗で AggregateError |

どのメソッドを選ぶかは失敗時の要件で決まる。1件でも失敗したら処理全体を中止するなら`Promise.all`、全結果を集めて個別に扱うなら`Promise.allSettled`を使う。

```typescript
const results = await Promise.allSettled(urls.map(url => fetch(url)));
const succeeded = results
  .filter((r): r is PromiseFulfilledResult<Response> => r.status === 'fulfilled')
  .map(r => r.value);
```

<a id="section-5-5"></a>
### 5.5 自作 Promise の実装
<!-- handbook:learning {"level":"advanced","minutes":15} -->
<!-- handbook:index {"group":"P","term":"Promise"} -->

<!-- handbook:narrative-bridge {"section":"5.5"} -->
Promiseの利用方法だけでは、なぜ`then`が同期的に実行されず、なぜ値とPromiseを同じチェーンで扱えるのかは見えにくい。ここでは利用者側の抽象を一度分解し、状態遷移とコールバック配送を実装することで、非同期合成の条件を確かめる。

Promiseの状態遷移とチェーンを理解するため、教材用の簡略版を実装する。以下はPromise/A+やECMAScriptの完全実装ではなく、本番コードやネイティブ`Promise`の代替には使用しない。

```typescript
type State = 'pending' | 'fulfilled' | 'rejected';

class MyPromise<T> {
  private state: State = 'pending';
  private value: T | undefined;
  private reason: unknown;
  private onFulfilledCallbacks: Array<(v: T) => void> = [];
  private onRejectedCallbacks: Array<(r: unknown) => void> = [];

  constructor(executor: (resolve: (v: T) => void, reject: (r: unknown) => void) => void) {
    const resolve = (v: T) => {
      if (this.state !== 'pending') return;
      this.state = 'fulfilled';
      this.value = v;
      // 教材上、コールバックを非同期にするためマイクロタスクを使う
      queueMicrotask(() => this.onFulfilledCallbacks.forEach(cb => cb(v)));
    };
    const reject = (r: unknown) => {
      if (this.state !== 'pending') return;
      this.state = 'rejected';
      this.reason = r;
      queueMicrotask(() => this.onRejectedCallbacks.forEach(cb => cb(r)));
    };
    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then<U>(onFulfilled?: (v: T) => U | MyPromise<U>, onRejected?: (r: unknown) => U | MyPromise<U>): MyPromise<U> {
    return new MyPromise<U>((resolve, reject) => {
      const handle = (v: T) => {
        try {
          if (!onFulfilled) return resolve(v as unknown as U);
          const result = onFulfilled(v);
          if (result instanceof MyPromise) {
            result.then(resolve, reject);
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      };
      const fail = (r: unknown) => {
        try {
          if (!onRejected) return reject(r);
          const result = onRejected(r);
          if (result instanceof MyPromise) {
            result.then(resolve, reject);
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      };

      if (this.state === 'fulfilled') queueMicrotask(() => handle(this.value!));
      else if (this.state === 'rejected') queueMicrotask(() => fail(this.reason));
      else {
        this.onFulfilledCallbacks.push(handle);
        this.onRejectedCallbacks.push(fail);
      }
    });
  }
}

// 使ってみる
new MyPromise<number>((resolve) => {
  setTimeout(() => resolve(42), 100);
})
  .then(v => v * 2)
  .then(v => console.log(v));  // 84
```

ポイント:

- 状態は `pending` → `fulfilled` または `rejected` の一方向遷移
- `then` の中身は**マイクロタスク**で実行する (第4章のイベントループを思い出してほしい)
- `then` が新しい Promise を返すからチェーンできる
- コールバックの戻り値が Promise なら、その resolve を待つ (これがチェーンの本質)

実際のPromiseには、任意のthenableを同化する解決手続き、自己解決と循環の検出、executorへ渡す`resolve`の入れ子Promise処理、種判定、ホストによる未処理拒否の追跡などが必要である。このコードは状態遷移の学習範囲に限る。

<a id="section-5-6"></a>
### 5.6 イテレータとジェネレータ
<!-- handbook:learning {"level":"advanced","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"5.6"} -->
Promiseは完了を一度だけ通知する非同期値を表現する。一方、複数の値を順番に生成する処理や、途中で停止・再開したい処理には別の抽象が必要になる。イテレータとジェネレータは、値の列と制御の中断点を共通のプロトコルで表す。

ES2015で導入された Iterator/Iterable プロトコルは、JavaScriptの中で過小評価されている機能だ。

```typescript
// Iterable プロトコル: Symbol.iterator メソッドを持つ
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      }
    };
  }
};

for (const n of range) console.log(n);  // 1, 2, 3, 4, 5
[...range];  // [1, 2, 3, 4, 5] (スプレッド)
```

ジェネレータは Iterable を簡潔に書ける構文だ。

```typescript
function* range(from: number, to: number) {
  for (let i = from; i <= to; i++) yield i;
}

for (const n of range(1, 5)) console.log(n);
```

**無限シーケンス:**

```typescript
function* naturals() {
  let n = 1;
  while (true) yield n++;
}

function* take<T>(iter: Iterable<T>, n: number) {
  let count = 0;
  for (const v of iter) {
    if (count++ >= n) return;
    yield v;
  }
}

[...take(naturals(), 5)];  // [1, 2, 3, 4, 5]
```

**非同期ジェネレータ (`async function*`):**

ストリーミング処理に強力。

```typescript
async function* fetchPages(baseUrl: string) {
  let cursor: string | null = null;
  do {
    const url = cursor ? `${baseUrl}?cursor=${cursor}` : baseUrl;
    const res = await fetch(url);
    const data: { items: any[]; nextCursor: string | null } = await res.json();
    for (const item of data.items) yield item;
    cursor = data.nextCursor;
  } while (cursor);
}

for await (const item of fetchPages('/api/users')) {
  console.log(item);  // 1件ずつ処理、メモリに全件乗せない
}
```

<a id="section-5-7"></a>
### 5.7 TypeScript ― 型システムの設計思想
<!-- handbook:learning {"level":"required","minutes":20} -->
<!-- handbook:index {"group":"T","term":"TypeScript"} -->

<!-- handbook:narrative-bridge {"section":"5.7"} -->
ここまでの仕組みは実行時に正しく動くためのものだった。しかし、値の形や関数の契約に関する誤りを実行前に見つけたい場合、JavaScriptだけでは情報が足りない。TypeScriptは実行モデルを変えずに、コード上の関係へ静的な制約を加える。

TypeScriptは「JavaScriptに型を付ける言語」と説明されるが、それは半分しか正しくない。TypeScriptの真価は**構造的型システム**にある。

**公称型 (Java、C#) vs 構造的型 (TypeScript、Go):**

```typescript
type Point2D = { x: number; y: number };
type Vector2D = { x: number; y: number };

const p: Point2D = { x: 0, y: 0 };
const v: Vector2D = p;  // OK: 構造が同じならOK
```

JavaやC#なら「`Point2D` と `Vector2D` は別の型だ」とエラーになる。TypeScriptは構造で判断する。これは JavaScript の動的性質に合わせた現実的な選択だ。

**基本的な型:**

```typescript
let s: string = 'hello';
let n: number = 42;
let b: boolean = true;
let nu: null = null;
let un: undefined = undefined;
let arr: number[] = [1, 2, 3];
let tuple: [string, number] = ['a', 1];
let obj: { name: string; age: number } = { name: 'Alice', age: 30 };
let fn: (x: number) => string = (x) => x.toString();
let union: string | number = 'a';
let literal: 'red' | 'green' | 'blue' = 'red';
```

**ユニオン型と判別可能ユニオン:**

```typescript
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rectangle'; width: number; height: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle':    return Math.PI * s.radius ** 2;
    case 'square':    return s.side ** 2;
    case 'rectangle': return s.width * s.height;
    // exhaustiveness check
    default: {
      const _exhaustive: never = s;
      throw new Error(_exhaustive);
    }
  }
}
```

`kind` のような**判別子**を使うと、TypeScriptは各 case の中で型を絞り込んでくれる (Narrowing)。`never` を使った網羅性チェックは、新しい kind が追加されたときコンパイルエラーで気づける重要なテクニック。

**ジェネリクス:**

```typescript
function identity<T>(value: T): T {
  return value;
}

// 制約付き
function getLength<T extends { length: number }>(value: T): number {
  return value.length;
}

// 型を引き出す
type ArrayElement<T> = T extends (infer U)[] ? U : never;
type N = ArrayElement<number[]>;  // number
```

**Conditional Types と Mapped Types:**

```typescript
// 全プロパティをオプショナルに
type Partial<T> = { [K in keyof T]?: T[K] };

// 全プロパティを読み取り専用に
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// 特定のキーだけ取り出す
type Pick<T, K extends keyof T> = { [P in K]: T[P] };

// 特定のキーを除外
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// 文字列リテラルを操作
type Getter<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getter<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }
```

これらの組み合わせで、APIレスポンスの型を生成したり、フォームの型を導出したりできる。

**型ガード:**

```typescript
function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function process(v: string | number) {
  if (isString(v)) {
    v.toUpperCase();  // ここで v は string
  } else {
    v.toFixed(2);     // ここで v は number
  }
}
```

`v is string` という戻り型を「型述語 (type predicate)」と呼ぶ。これは「この関数が `true` を返したら、引数は string だと信じてよい」という宣言だ。

**`unknown` vs `any`:**

```typescript
let a: any = 'hello';
a.toUpperCase();  // 通る、しかし実行時に存在しないメソッドだったらクラッシュ

let u: unknown = 'hello';
u.toUpperCase();  // コンパイルエラー (型が分からないので)
if (typeof u === 'string') u.toUpperCase();  // OK (絞り込み済み)
```

`any` は型システムを無効化する。`unknown` は「型が不明」を表現し、使う前に絞り込みを強制する。**`any` は原則禁止、`unknown` を使う**が現代の慣習だ。

**`satisfies` 演算子 (TS 4.9〜):**

```typescript
type Color = 'red' | 'green' | 'blue';
type ColorMap = Record<Color, string>;

// 型注釈を付けると、型が広がってしまう (literal 性が失われる)
const colors1: ColorMap = { red: '#ff0000', green: '#00ff00', blue: '#0000ff' };
colors1.red.toUpperCase();  // string 扱い

// satisfies なら literal 性を保ちつつ ColorMap を満たすことを確認
const colors2 = { red: '#ff0000', green: '#00ff00', blue: '#0000ff' } satisfies ColorMap;
// colors2.red は '#ff0000' リテラル型として推論される
```

<a id="section-5-8"></a>
### 5.8 Proxy と Reflect ― メタプログラミング
<!-- handbook:learning {"level":"advanced","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"5.8"} -->
型はコンパイル時の関係を検査するが、実行時にオブジェクト操作そのものを観測・変更したい場面もある。リアクティビティやバリデーションでは、プロパティの読み書きを横断的に捕捉する必要があり、ProxyとReflectがそのフックを提供する。

Proxyはオブジェクトへの全操作をフック可能にする機構だ。リアクティビティ (Vue 3など) の基盤。

```typescript
const target = { count: 0 };

const handler: ProxyHandler<typeof target> = {
  get(obj, prop, receiver) {
    console.log(`GET ${String(prop)}`);
    return Reflect.get(obj, prop, receiver);
  },
  set(obj, prop, value, receiver) {
    console.log(`SET ${String(prop)} = ${value}`);
    return Reflect.set(obj, prop, value, receiver);
  }
};

const proxy = new Proxy(target, handler);
proxy.count;       // "GET count"
proxy.count = 1;   // "SET count = 1"
```

**Reflect** は Proxy ハンドラ内で「元の操作」を行うAPIだ。`obj[prop]` のような直接アクセスでも動くが、Reflect 経由のほうが receiver (継承時のthis) を正しく扱える。

応用例: Vue 3 の `reactive()` はこの仕組みで、プロパティアクセスを検出して依存を追跡し、変更を検出して再描画をトリガーする。`ref()` は Proxy ではなく `.value` のゲッタ・セッタで同じことを行う。

<a id="section-5-9"></a>
### 5.9 エラー処理の設計
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"5.9"} -->
処理を抽象化し、非同期化し、動的に介入できるようになるほど、失敗は複数の層をまたいで伝播する。例外を投げるだけでは、回復可能な失敗とプログラム上の欠陥を区別できない。ここでは失敗をAPI契約として設計する。

JavaScript のエラー設計には言語仕様の落とし穴が多い。

**`try/catch` の基本:**

```typescript
try {
  throw new Error('something failed');
} catch (e) {
  // TypeScript 4.4 以降、strict の下では既定で e は unknown (4.0 で可能になったのは明示注釈)
  if (e instanceof Error) {
    console.error(e.message, e.stack);
  } else {
    console.error('Unknown error:', e);
  }
}
```

**カスタムエラークラス:**

```typescript
class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// 呼び出し側で型で分岐
try {
  // ...
} catch (e) {
  if (e instanceof ValidationError) {
    return { status: 400, error: e.message, field: e.field };
  }
  if (e instanceof NotFoundError) {
    return { status: 404, error: e.message };
  }
  throw e;  // 想定外は上に投げる
}
```

**Result 型パターン (Rust 風):**

例外を投げる代わりに、明示的に成否を返す設計もある。

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

async function fetchUser(id: string): Promise<Result<User, NotFoundError | NetworkError>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (res.status === 404) return { ok: false, error: new NotFoundError(id) };
    if (!res.ok) return { ok: false, error: new NetworkError(res.status) };
    return { ok: true, value: await res.json() };
  } catch (e) {
    return { ok: false, error: new NetworkError(0) };
  }
}

const result = await fetchUser('42');
if (!result.ok) {
  // result.error の型が NotFoundError | NetworkError に絞り込まれる
  return;
}
// 以下で result.value (User) を使える
```

この設計はエラーを「忘れて握り潰す」事故を型で防げる。重要なAPIで採用価値が高い。

<a id="section-5-10"></a>
### 5.10 メモリとガベージコレクション
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"ま行","term":"メモリ管理"} -->

<!-- handbook:narrative-bridge {"section":"5.10"} -->
エラーが表面化しなくても、参照が残り続ければアプリケーションは徐々に劣化する。クロージャ、イベントリスナー、キャッシュは便利な一方、オブジェクトの寿命を延ばす。実行結果だけでなく、到達可能性という観点から状態の後始末を考える必要がある。

JavaScriptには明示的なメモリ解放がない。**ガベージコレクタ (GC)** が、参照されなくなったオブジェクトを回収する。

**到達可能性:**

GCのアルゴリズムは「ルートから辿れるか」で判断する。ルートはグローバル変数、現在のコールスタック、現在のクロージャなど。ここから辿れないオブジェクトは回収対象。

**よくあるリーク原因:**

1. **意図しないグローバル変数**: `var` を忘れて代入 (`x = 1`)、または `this` への代入
2. **外したリスナーを残す**: `addEventListener` した DOM 要素が消えても、リスナー側が参照を握っていると要素ごと残る
3. **タイマー**: `setInterval` の中でクロージャがオブジェクトを参照していると、停止しない限り残る
4. **デタッチされた DOM**: JavaScript変数が DOM 要素を保持していると、document から外しても解放されない

**WeakRef と WeakMap:**

弱参照を作る仕組み。

```typescript
// WeakMap: キーが弱参照
const cache = new WeakMap<object, ComputedValue>();
function getCached(obj: object) {
  if (cache.has(obj)) return cache.get(obj);
  const v = compute(obj);
  cache.set(obj, v);
  return v;
}
// obj が他で参照されなくなれば、cache のエントリも自動消滅
```

`WeakMap` は DOM 要素に紐づくメタデータを持つときに有用 (要素が消えればメタデータも消える)。

<a id="section-5-11"></a>
### 5.11 国際化 (i18n) ― 多言語対応の現実
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"I","term":"i18n (国際化)"} -->
<!-- handbook:index {"group":"I","term":"Intl API"} -->
<!-- handbook:index {"group":"か行","term":"国際化 (i18n)"} -->
<!-- handbook:index {"group":"は行","term":"翻訳ワークフロー"} -->

<!-- handbook:narrative-bridge {"section":"5.11"} -->
正しく動き、資源も回収できるコードであっても、文字列・数値・日時の表現を一つの地域へ固定すると利用者には正しく伝わらない。国際化は翻訳文字列の置換ではなく、データ表現とUIの契約を地域差から分離する設計である。

「日本語と英語くらい簡単」と思っていると、言語ごとの事情の幅に足をすくわれる。

#### i18n と l10n の違い

- **i18n (internationalization)**: 多言語対応**できる**仕組みを作ること
- **l10n (localization)**: 特定言語向けに**実際に翻訳・調整**すること

i18n はコードの責任、l10n は翻訳者の責任。両者を分離するのが定石。

#### 配慮すべき領域

- **テキスト翻訳**: メッセージカタログでキーから訳文を引く
- **数値・通貨フォーマット**: `1,234.56` (米) vs `1.234,56` (独) vs `١٬٢٣٤` (ア)
- **日付・時刻**: 月日年の順、12/24時間、曜日始まり (月曜 vs 日曜)
- **複数形ルール**: 英語は 0/1/多 だが、ロシア語・アラビア語は6種類以上
- **文字方向**: アラビア語・ヘブライ語は RTL (right-to-left)
- **テキスト膨張**: ドイツ語は英語より平均30%長い → レイアウト破綻
- **文字種**: 日本語・中国語は1文字に絵柄、CJK 統合漢字の罠
- **入力方式**: IME (日本語、中国語)、ベトナム語の声調記号

#### Intl API ― ブラウザ標準

```typescript
// 数値
new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(1234567);
// → '¥1,234,567'
new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.56);
// → '1.234,56 €'

// 日付
new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/New_York',
}).format(new Date());
// → 'May 20, 2026 at 1:23 PM'

// 相対時刻
new Intl.RelativeTimeFormat('ja-JP').format(-3, 'day');  // '3 日前'

// 複数形ルール
const pr = new Intl.PluralRules('ru');
pr.select(0);   // 'many'
pr.select(1);   // 'one'
pr.select(2);   // 'few'
pr.select(5);   // 'many'

// リスト
new Intl.ListFormat('en').format(['apple', 'banana', 'orange']);
// → 'apple, banana, and orange'

// 文字列比較 (ロケール固有)
['ä', 'z', 'a'].sort(new Intl.Collator('de').compare);  // ['a', 'ä', 'z']
['ä', 'z', 'a'].sort(new Intl.Collator('sv').compare);  // ['a', 'z', 'ä'] (ä は z の後)
```

#### React での i18n 実装 (react-intl)

```tsx
import { IntlProvider, FormattedMessage, FormattedNumber, useIntl } from 'react-intl';

// メッセージ定義
const messages = {
  ja: {
    'greeting': 'こんにちは、{name}さん',
    'cart.items': '{count, plural, =0 {カートは空です} one {# 件} other {# 件}}',
  },
  en: {
    'greeting': 'Hello, {name}',
    'cart.items': '{count, plural, =0 {Cart is empty} one {# item} other {# items}}',
  },
  ru: {
    'greeting': 'Привет, {name}',
    'cart.items': '{count, plural, =0 {Корзина пуста} one {# товар} few {# товара} many {# товаров} other {# товара}}',
  },
};

// アプリの最上位
<IntlProvider locale={userLocale} messages={messages[userLocale]}>
  <App />
</IntlProvider>

// 利用
function Greeting({ user }: { user: { name: string } }) {
  return (
    <h1>
      <FormattedMessage id="greeting" values={{ name: user.name }} />
    </h1>
  );
}

// 動的なメッセージ
function CartBadge({ count }: { count: number }) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'cart.items' }, { count });
  return <span aria-label={label}>{count}</span>;
}
```

ICU MessageFormat 構文 (`{count, plural, ...}`) は CLDR データに基づき、各言語の複数形ルールを自動で適用する。翻訳者は ICU 文法で書くだけで、コードを変えずに各言語に対応できる。

#### 翻訳ワークフロー

- **抽出**: コードから翻訳キーを抜き出す (`formatjs extract`)
- **翻訳サービス**: Crowdin、Lokalise、Phrase
- **CI連携**: 翻訳追加が自動でPRに
- **未訳の検出**: ビルド時に欠落キーを警告
- **擬似ロケール**: `[!! Ḣéḻḻö !!]` で「未翻訳テキスト」「テキスト膨張」を強調表示

#### よくある罠

- **文字列連結**: `'Hello ' + name + '!'` → 言語によって語順が違う、必ず変数埋め込みで書く
- **複数形を if 文で**: `count === 1 ? 'item' : 'items'` → 英語以外で破綻、ICU を使う
- **日付の手動フォーマット**: `${y}/${m}/${d}` → ロケール無視、`Intl.DateTimeFormat` を使う
- **画像内のテキスト**: 翻訳できない、SVG なら可能だがコスト高
- **タイムゾーン無視**: サーバ・クライアントで UTC 統一、表示時のみローカル変換

「**英語版を作って後で多言語化**」は地獄。i18n は最初から設計しておく方が遥かに安い。

<a id="section-5-12"></a>
### 5.12 実装課題 ― JavaScript と TypeScript の深奥
<!-- handbook:learning {"level":"practical","minutes":300} -->

<!-- handbook:narrative-bridge {"section":"5.12"} -->
ここまで扱った言語機能は互いに独立ではない。非同期処理はクロージャとイベントループに依存し、型は実行時検証を置き換えず、メモリ管理は参照共有と結びつく。実装課題では、これらを同じコード上で組み合わせ、境界を説明できるかを確認する。

第5章では JavaScript と TypeScript の核心的な仕組みを見た。本節では、自作することで深く理解する課題に取り組む。所要時間: 演習カードの推定時間の合計で10時間30分。

#### 課題5.1: Promise を自作する (★★★)

**目的**: Promise が「単なる値」ではなく「状態を持つステートマシン」であることを内部から理解する。

<!-- handbook:exercise:start {"id":"5.1"} -->
> **演習カード 課題5.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 5.5 自作 Promise の実装 を読み、pending/fulfilled/rejected の状態遷移とハンドラ登録の流れを追っておく
> - 5.4 非同期処理の進化 を読み、同期コード・マイクロタスク・タイマの実行順を予測できる状態にしておく
> - `pnpm install` 済みで `pnpm --filter @handbook/ch05 run test` が現状で完走することを確認しておく
> - TypeScript のジェネリッククラスと private フィールドを読み書きできる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch05/my-promise.ts` に `MyPromise` クラスを実装し、`then` / `catch` / `finally` がいずれも新しい `MyPromise` を返す
> - [ ] 静的メソッド `resolve` / `reject` / `all` / `allSettled` / `race` の5つが実装され、`all` は入力と同じ順序の配列で解決する
> - [ ] 解決済みインスタンスに後から登録した `.then` も同期実行されず、`queueMicrotask` 経由で1ティック後に走る
> - [ ] `then` を持つオブジェクト (thenable) を resolve へ渡すと同化され、自分自身を resolve すると TypeError で reject される
> - [ ] `solutions.test.ts` の import を自分の実装へ向け替えた状態で `pnpm --filter @handbook/ch05 run test` が全件パスする
>
> **期待出力**
>
> - テスト `MyPromise chains and schedules handlers as microtasks` と `MyPromise combinators and finally work` の2件が pass と表示される
> - 同期側の push を後から `unshift` した順序記録が `['sync', 'then']` になり、値は 42 になる
> - `MyPromise.allSettled([1, MyPromise.reject('x')])` が2要素の配列を返し、2件目の `status` が `rejected` になる
> - `await` に自作インスタンスを渡すとネイティブ側が `then` を呼び、`PromiseLike<T>` として解決値が取り出せる
>
> **観察項目**
>
> - resolve 済みの `MyPromise` に `.then` を登録した直後へ `console.log('sync')` を置き、ハンドラが必ず後に出ることを出力順で確認する
> - `queueMicrotask` を `setTimeout(fn, 0)` に差し替えて再実行し、どのテストの順序アサーションが崩れるかを記録する
> - `race` に即解決と5ms後解決の2つを渡し、遅い側が後から settle しても結果が上書きされないことを確認する
> - 同じコードをネイティブ Promise で書き、拒否を放置したときのプロセス終了コードと警告表示の差を比べる
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch05 run test` を実行し、MyPromise 関連の2テストが fail 0 でパスすれば合格
> 2. `pnpm --filter @handbook/ch05 run typecheck` を実行し、`implements PromiseLike<T>` を満たしたままエラー0件なら合格
> 3. `solutions.test.ts` に自己 resolve が TypeError になるケースを1件追加し、再実行して新テストも通れば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず「値」ではなく「状態」を持たせる。pending のあいだに来た `then` のコールバックを配列へ溜め、settle した瞬間にまとめて流す設計から始める
> 2. **構造**: `state`、`value`、`reason`、`handlers` の4フィールドと、内部関数 `flush()` を用意する。`then` は新しい MyPromise を作り、その resolve/reject を handlers のエントリへ一緒に格納する
> 3. **実装の要点**: resolve に渡された値が object または function なら `value.then` を取り出し、function なら `then.call(value, resolve, reject)` で同化する。ここを飛ばすと `all` にネイティブ Promise を混ぜたテストが落ちる
>
> **本番利用時の警告**
>
> - この MyPromise は未処理拒否の検知、`any` の AggregateError、サブクラス化 (Symbol.species) を持たない。本番コードでネイティブ Promise の代わりに使うと拒否が黙って消える
> - handlers 配列に上限がなく、pending のまま大量に `then` を張るとメモリを解放できない。長寿命のイベント配線には使わない
>
> **導線**
>
> - 開始地点: `code/ch05/my-promise.ts`
> - 模範解答: `code/ch05/my-promise.solution.ts`
>
> **推定時間の内訳**: 状態遷移と then/catch/finally の実装に50分、静的メソッド5種の追加に50分、マイクロタスク順序の検証とテスト追記に50分
<!-- handbook:exercise:end -->

**要件**: まずPromise/A+の`then`解決手続きを対象に`MyPromise`を実装し、公式テストスイート相当のケースで検証する。静的メソッドはPromise/A+の範囲外なので、別の発展課題としてECMAScriptの挙動を確認しながら追加する。

- `constructor((resolve, reject) => {})` を受け取る
- `.then(onFulfilled, onRejected)` チェイン対応
- `.catch(onRejected)`
- `.finally(onFinally)`
- 静的メソッド: `MyPromise.resolve(value)`, `MyPromise.reject(reason)`, `MyPromise.all([...])`, `MyPromise.allSettled([...])`, `MyPromise.race([...])`

**テスト**:
```typescript
const p = new MyPromise<number>((resolve) => {
  setTimeout(() => resolve(42), 100);
});
p.then((x) => x + 1)
 .then((x) => console.log(x))  // 43
 .catch((e) => console.error(e));

// async/await でも動く
const value = await p;
```

**評価基準**:
- 5.5 で本書が示した実装をベースに、`all`、`allSettled`、`race`、`finally` を追加
- マイクロタスクキューで `.then` を実行 (`queueMicrotask` 使用)
- 教材用テストとPromise/A+対象範囲のテストを通過する (ネイティブPromiseの完全な置換を完了条件にしない)

模範解答: `code/ch05/my-promise.solution.ts`

#### 課題5.2: Generator から async/await を再発明 (★★★)

**目的**: async/await が Generator のシンタックスシュガーであることを実装で確認する。

<!-- handbook:exercise:start {"id":"5.2"} -->
> **演習カード 課題5.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 5.6 イテレータとジェネレータ を読み、`next()` が返す `{ value, done }` と `throw()` の動作を把握しておく
> - 5.4 非同期処理の進化 を読み、async 関数が Promise を返すことと await の一時停止を説明できる状態にする
> - `pnpm --filter @handbook/ch05 run test` が実行できる環境を用意する
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch05/run-async.ts` に `runAsync(generator)` を実装し、戻り値が Promise になる
> - [ ] yield された値が Promise のときは解決値を、Promise 以外のときはその値をそのまま `next(value)` へ渡す
> - [ ] yield した Promise が reject したとき `generator.throw(error)` を呼び、ジェネレータ内の try/catch で捕捉できる
> - [ ] ジェネレータ内で捕捉されなかったエラーは `runAsync` の戻り Promise の reject として外へ伝わる
> - [ ] `done: true` になった時点で `value` を解決値として返し、以降 `next` を呼ばない
>
> **期待出力**
>
> - テスト `runAsync propagates resolved values and errors` が pass する
> - `yield Promise.resolve(20)` と `yield Promise.resolve(22)` を持つジェネレータの実行結果が 42 になる
> - `yield Promise.reject(new Error('boom'))` を含むジェネレータでは、戻り Promise が `/boom/` にマッチするエラーで reject する
> - 同じ処理を async/await で書き直した版と、出力される値と実行順が完全に一致する
>
> **観察項目**
>
> - `next()` の呼び出しごとに `console.log(value, done)` を仕込み、yield 1回につき next が1回進むことを確認する
> - yield に非 Promise の値 (数値やオブジェクト) を渡し、そのまま次の next へ流れることを確認する
> - ジェネレータ内を try/catch で囲み、`generator.throw` 経由の例外が catch 節へ入って処理が続くことを確認する
> - 2つの独立した fetch を順に yield した場合の総所要時間を計り、逐次実行であって並行実行ではないことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch05 run test` を実行し、runAsync のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch05 run typecheck` でエラー0件なら、`Generator<Yieldable<unknown>, T, unknown>` のシグネチャが成立している
> 3. 自作ジェネレータで `try { yield Promise.reject(new Error('x')) } catch (e) { return 'caught' }` を書き、戻り値が `'caught'` になれば throw 経路の実装が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ドライバは再帰的なループになる。`next()` の結果を見て、done なら resolve、そうでなければ value を待ってから自分自身をもう一度呼ぶ、という一段階だけを先に書く
> 2. **構造**: 内部関数 `step(input)` と `fail(error)` の2本に分け、`Promise.resolve(value).then(step, fail)` で次の一歩をつなぐ。`fail` の中では `generator.throw(error)` の結果を再び同じ経路へ流す
> 3. **実装の要点**: `generator.throw()` 自体が例外を投げる場合 (ジェネレータ側で捕捉されなかった場合) がある。ここを try/catch で包んで外側 Promise の reject に変換しないと、未処理拒否になる
>
> **本番利用時の警告**
>
> - このドライバは逐次実行専用で、キャンセルもタイムアウトも持たない。解決しない Promise を yield するとジェネレータが永久に停止し、参照が残ったままリークする
> - 実務では async/await を使う。トランスパイル済みコードの挙動確認や学習目的以外で自作ドライバを運用コードへ入れると、スタックトレースが読めなくなる
>
> **導線**
>
> - 開始地点: `code/ch05/run-async.ts`
> - 模範解答: `code/ch05/run-async.solution.ts`
>
> **推定時間の内訳**: next/value の往復ドライバ実装に40分、エラー経路と throw 対応に50分、async/await 版との挙動比較と観察記録に60分
<!-- handbook:exercise:end -->

**要件**: `runAsync(generator)` 関数を実装する。Generator が yield で Promise を返したら、それを await して値を `next()` に渡す。

```typescript
function* example() {
  const a = yield fetch('/api/a').then((r) => r.json());
  const b = yield fetch('/api/b').then((r) => r.json());
  return a.value + b.value;
}

// これと等価:
// async function example() {
//   const a = await fetch('/api/a').then((r) => r.json());
//   const b = await fetch('/api/b').then((r) => r.json());
//   return a.value + b.value;
// }

const result = await runAsync(example());
```

**ヒント**:
1. generator.next() を呼ぶと `{ value, done }` が返る
2. `value` が Promise なら await
3. await された値を次の `next(value)` に渡す
4. `done: true` で完了
5. エラー処理は `generator.throw(err)` を使う

模範解答: `code/ch05/run-async.solution.ts`

#### 課題5.3: TypeScript 型レベルプログラミング (★★★)

**目的**: TypeScript の型システムが「**コンパイル時のプログラミング言語**」として動くことを体感する。

<!-- handbook:exercise:start {"id":"5.3"} -->
> **演習カード 課題5.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 5.7 TypeScript ― 型システムの設計思想 を読み、条件型・`infer`・テンプレートリテラル型の書き方を把握しておく
> - タプル型とスプレッド構文 (`[infer H, ...infer R]`) の読み方を理解している
> - `pnpm --filter @handbook/ch05 run typecheck` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch05/type-gymnastics.ts` に `Length` / `Head` / `Tail` / `Reverse` / `Concat` / `DeepReadonly` / `PathOf` / `CamelCase` の8つを型定義だけで書く
> - [ ] 8つの型に実行時コード (関数・変数) を一切追加していない
> - [ ] `Equal<A, B>` と `Assert<T extends true>` を自分でも定義し、各型に少なくとも1件ずつコンパイル時アサーションを置く
> - [ ] `pnpm --filter @handbook/ch05 run typecheck` がエラー0件で完了する
> - [ ] わざと誤った期待値 (例: `Assert<Equal<Length<[1,2,3]>, 4>>`) を書くと typecheck が失敗することを一度確認して元に戻す
>
> **期待出力**
>
> - `pnpm --filter @handbook/ch05 run typecheck` が何も出力せず終了コード0で終わる
> - エディタのホバーで `CamelCase<"hello_world_foo">` が `"helloWorldFoo"` と展開表示される
> - `PathOf<{ a: { b: { c: 1 } } }>` が `"a"`、`"a.b"`、`"a.b.c"` の3つからなるユニオンとして表示される
> - `Reverse<[1, 2, 3]>` が `[3, 2, 1]` に、`Concat<[1, 2], [3, 4]>` が `[1, 2, 3, 4]` に展開される
>
> **観察項目**
>
> - `Reverse` をアキュムレータ引数なしの素朴な再帰で書き、要素数を増やしたときに `Type instantiation is excessively deep` が出る境界を確認する
> - エディタのホバー表示で、型が途中で `...` に省略される長さを観察し、可読性のための named type の必要性を記録する
> - `DeepReadonly` を配列や関数型へ適用し、意図せず関数のプロパティまで readonly 化されないかを確認する
> - `PathOf` を optional プロパティを含む型へ適用し、`keyof` の抽出結果が変わることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch05 run typecheck` を実行し、エラー0件なら8つの型定義とアサーションが成立している
> 2. `Assert<Equal<CamelCase<"a_b_c">, "aBC">>` のように誤った期待値を1行足して typecheck を再実行し、エラーが1件出れば検証機構が機能している
> 3. この課題は `code/ch05/solutions.test.ts` の対象外なので、実行時テストではなく typecheck の結果で合否を判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 8つを難しい順にやらない。`Length` はタプルの `['length']` を読むだけ、`Head` と `Tail` は `infer` 1回で書ける。ここで条件型の型を掴んでから再帰型へ進む
> 2. **構造**: `Reverse` は第2引数にアキュムレータ `Acc extends readonly unknown[] = []` を持たせた末尾再帰型にする。`CamelCase` は `S extends \`${infer H}_${infer T}\`` でスネークケースを分解し、`Capitalize<>` と組み合わせる
> 3. **実装の要点**: `PathOf` はマップ型で各キーについて「そのキー自身」と「そのキー + ドット + 子のパス」を作りユニオン化する。子が object でないときに再帰を止めないと無限展開でコンパイルが止まる
>
> **本番利用時の警告**
>
> - 型レベルの保証はコンパイル時にしか働かない。API レスポンスやフォーム入力に `PathOf` や `DeepReadonly` を掛けても実行時の値は検証されないため、境界では zod などのランタイム検証を併用する
> - 深い再帰型はコンパイル時間とエディタ補完の応答を悪化させる。共有ライブラリの公開型でこの手法を多用すると、利用側プロジェクト全体のビルドが遅くなる
>
> **導線**
>
> - 開始地点: `code/ch05/type-gymnastics.ts`
> - 模範解答: `code/ch05/type-gymnastics.solution.ts`
>
> **推定時間の内訳**: Length/Head/Tail/Concat の実装に30分、Reverse と DeepReadonly の再帰化に40分、PathOf と CamelCase に50分、アサーション追加と再帰深度の観察に30分
<!-- handbook:exercise:end -->

**要件**: 以下の型を**型定義のみで**(実装コードなしで) 書く。

```typescript
// Length<T> - タプルの長さを取得
type Length<T extends readonly any[]> = ???;
type L1 = Length<[1, 2, 3]>;  // 3

// Head<T> - タプルの先頭
type Head<T extends readonly any[]> = ???;
type H1 = Head<[1, 2, 3]>;  // 1

// Tail<T> - タプルの末尾以外
type Tail<T extends readonly any[]> = ???;
type T1 = Tail<[1, 2, 3]>;  // [2, 3]

// Reverse<T> - タプルを反転
type Reverse<T extends readonly any[]> = ???;
type R1 = Reverse<[1, 2, 3]>;  // [3, 2, 1]

// Concat<A, B> - 2つのタプルを連結
type Concat<A extends readonly any[], B extends readonly any[]> = ???;
type C1 = Concat<[1, 2], [3, 4]>;  // [1, 2, 3, 4]

// DeepReadonly<T> - 再帰的にreadonly化
type DeepReadonly<T> = ???;

// PathOf<T> - ネストオブジェクトのパス文字列をユニオン型で
// 例: PathOf<{a: {b: {c: 1}}}> = "a" | "a.b" | "a.b.c"
type PathOf<T> = ???;

// CamelCase<S> - スネークケース→キャメルケース
type CamelCase<S extends string> = ???;
type CC = CamelCase<"hello_world_foo">;  // "helloWorldFoo"
```

**ヒント**:
- `infer` キーワード
- 条件型 `T extends U ? X : Y`
- 再帰的な型定義
- テンプレートリテラル型 `${T}_${U}`

模範解答: `code/ch05/type-gymnastics.solution.ts`

#### 課題5.4: イベントエミッタを型安全に (★★)

**目的**: TypeScript の Generics と Mapped Type を活用して、イベント名と引数の型が完全に一致するエミッタを作る。

<!-- handbook:exercise:start {"id":"5.4"} -->
> **演習カード 課題5.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 5.7 TypeScript ― 型システムの設計思想 を読み、ジェネリクスとマップ型 (`Record<PropertyKey, unknown>` の制約) を扱えるようにする
> - 5.3 関数 ― First-class Citizen を読み、コールバックをコレクションへ保持する書き方を把握しておく
> - `pnpm --filter @handbook/ch05 run test` と `run typecheck` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch05/typed-emitter.ts` に `TypedEmitter<Events extends Record<PropertyKey, unknown>>` を実装し、`on` / `off` / `once` / `emit` の4メソッドを持つ
> - [ ] `on(name, listener)` が解除関数を返し、その関数を呼ぶと以後 emit されても呼ばれない
> - [ ] `once` で登録したリスナーは1回目の emit だけで実行され、2回目以降は呼ばれない
> - [ ] イベント名ごとに payload の型が推論され、`emitter.emit('user:login', { wrong: 'shape' })` と `emitter.emit('unknown:event', {})` がいずれも typecheck でエラーになる
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch05 run test` が全件パスする
>
> **期待出力**
>
> - テスト `TypedEmitter supports on/off/once` が pass する
> - `on` と `once` を登録し `emit('tick', 2)`、`emit('tick', 3)`、解除、`emit('tick', 4)` と進めたとき、記録配列が `[2, 20, 3]` になる
> - 誤ったイベント名で emit したときの typecheck エラーが、`Argument of type ...` としてイベント名リテラルを含む形で表示される
> - 登録していないイベントへ emit しても例外にならず、何も起きずに戻る
>
> **観察項目**
>
> - リスナーの保持を配列から `Set` へ変えて、同じ関数を2回 on したときの呼び出し回数の違いを確認する
> - emit の途中でリスナー内から `off` を呼び、反復中のコレクション変更が残りのリスナー実行へ与える影響を確認する
> - リスナーが例外を投げた場合に emit の呼び出し元まで伝播し、後続リスナーが実行されないことを確認する
> - `once` の実装を「ラッパ関数を登録して中で off する」形にしたとき、返す解除関数がラッパではなく元の関数でも効くかを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch05 run test` を実行し、TypedEmitter のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch05 run typecheck` を実行し、エラー0件なら型付けは成立している
> 3. `emitter.emit('unknown:event', {})` を一時的に書いて typecheck を再実行し、エラーが出ることを確認してから削除する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 型より先に素の実装を通す。イベント名をキー、リスナーの集合を値とする Map を1つ持つところから始め、そのあとで型引数 `Events` を被せる
> 2. **構造**: `Listener<T> = (payload: T) => void` を定義し、内部保持は `Map<keyof Events, Set<Listener<unknown>>>` にする。公開メソッドの引数は `K extends keyof Events` と `Events[K]` で結びつける
> 3. **実装の要点**: `once` はラッパ関数を登録し、その中で本体を呼んだあと自分自身を off する。返す解除関数は本体ではなくラッパを外す必要があり、ここを間違えると once が解除できないリスナーとして残る
>
> **本番利用時の警告**
>
> - リスナーへの強参照を Set に保持し続けるため、コンポーネント破棄時に解除関数を呼ばないとクロージャごとリークする。React などでは必ず cleanup で off を呼ぶ
> - リスナーの例外を捕捉していないため、1つのリスナーが throw すると emit 元まで伝播し、後続リスナーが実行されない。本番では Node の EventEmitter (captureRejections) や DOM の EventTarget を使う
>
> **導線**
>
> - 開始地点: `code/ch05/typed-emitter.ts`
> - 模範解答: `code/ch05/typed-emitter.solution.ts`
>
> **推定時間の内訳**: Map と Set によるリスナー管理の実装に30分、on/off/once/emit の型付けに40分、故意の型エラー確認とテスト実行に20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
interface MyEvents {
  'user:login': { userId: string; timestamp: number };
  'user:logout': { userId: string };
  'data:update': { table: string; rowId: number };
}

const emitter = new TypedEmitter<MyEvents>();

emitter.on('user:login', (data) => {
  // data は { userId: string; timestamp: number } と推論される
  console.log(data.userId);
});

emitter.emit('user:login', { userId: 'alice', timestamp: Date.now() });
// 型安全: 引数のキー名がリテラル型でチェックされる
// emitter.emit('user:login', { wrong: 'shape' });  // ✗ コンパイルエラー
// emitter.emit('unknown:event', {});               // ✗ コンパイルエラー
```

**評価基準**:
- `.on()`, `.off()`, `.emit()`, `.once()` を実装
- 全部型安全 (誤ったイベント名・引数で型エラー)
- `.off()` でリスナーを削除可能

模範解答: `code/ch05/typed-emitter.solution.ts`

#### 課題5.5: Intl API で実用的な国際化ユーティリティ (★★)

**目的**: ライブラリに頼らず、ブラウザ標準の Intl API だけで多言語アプリの基本機能を作る。

<!-- handbook:exercise:start {"id":"5.5"} -->
> **演習カード 課題5.5** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 5.11 国際化 (i18n) ― 多言語対応の現実 を読み、ロケール識別子と CLDR の複数形カテゴリを把握しておく
> - Node.js が full-icu 付き (`process.versions.icu` が表示される) であることを確認しておく
> - `pnpm --filter @handbook/ch05 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch05/i18n-utils.ts` に `formatNumber` / `formatCurrency` / `formatDate` / `formatRelativeTime` / `plural` / `formatList` の6関数を実装する
> - [ ] 6関数すべてが `Intl` のコンストラクタだけを使い、外部の i18n ライブラリへ依存していない
> - [ ] `plural` が `Intl.PluralRules` の select 結果でメッセージを選び、`{n}` をロケール書式の数値へ置換する
> - [ ] `plural` は value が 0 かつ `zero` メッセージが与えられたときだけ zero を選び、無ければ `other` へ落ちる
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch05 run test` が全件パスする
>
> **期待出力**
>
> - テスト `Intl helpers produce locale-aware values` が pass する
> - `formatCurrency(1500, 'JPY', 'ja-JP')` の戻り値に `1,500` が含まれ、`formatCurrency(1500, 'USD', 'en-US')` は小数2桁の `$1,500.00` になる
> - `plural(0, 'en-US', { zero: 'no apples', one: '1 apple', other: '{n} apples' })` が `no apples`、`plural(5, ...)` が `5 apples` を返す
> - `formatList(['Apple', 'Banana', 'Cherry'], 'en-US', 'conjunction')` が `Apple, Banana, and Cherry`、`ja-JP` では読点区切りになる
>
> **観察項目**
>
> - `formatRelativeTime(-3, 'day', 'ja-JP')` と `formatRelativeTime(-1, 'day', 'ja-JP')` を比べ、`numeric: 'auto'` が「昨日」のような語へ切り替わる境界を確認する
> - `formatCurrency` の出力を1文字ずつコードポイント表示し、通貨記号と数値の間に非分割スペースが入るロケールがあることを確認する
> - `ru-RU` や `ar-EG` など one/few/many を持つロケールで `plural` を呼び、`en-US` の one/other とカテゴリ数が違うことを確認する
> - `Intl.NumberFormat.supportedLocalesOf` の戻り値を見て、実行環境が実際に対応しているロケールを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch05 run test` を実行し、Intl ヘルパのテストが pass すれば合格
> 2. `node -e "console.log(new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(1500))"` を実行し、期待どおりの通貨表記が出れば ICU データは十分
> 3. `node -p "Intl.PluralRules.prototype.resolvedOptions.call(new Intl.PluralRules('ru-RU')).pluralCategories"` で対象ロケールのカテゴリ一覧を出し、自作 `plural` の分岐が網羅しているか照合する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 6関数すべてが「対応する Intl コンストラクタを1つ選び、options を渡して format を呼ぶ」だけの薄いラッパになる。まず素直に1対1で対応付ける
> 2. **構造**: `formatDate` は `dateStyle`、`formatRelativeTime` は `Intl.RelativeTimeFormat` の `numeric` オプション、`formatList` は `Intl.ListFormat` の `type` を使う。`plural` だけが `Intl.PluralRules` の select と自前のメッセージ選択の2段構えになる
> 3. **実装の要点**: `plural` の `zero` は CLDR の正式カテゴリとして en-US には存在しない。value が 0 のときだけ明示的に `messages.zero` を優先し、そのうえで `{n}` を `Intl.NumberFormat` で整形した文字列へ置換する
>
> **本番利用時の警告**
>
> - Intl の出力文字列は ICU のバージョンで変わる。整形済み文字列に完全一致のスナップショットテストを掛けると、Node やブラウザの更新で本番前に落ちる。テストは部分一致か `formatToParts` で書く
> - 表示用の丸めを金額計算へ流用しない。`Intl.NumberFormat` は表示桁で丸めるだけで、決済金額の計算には最小通貨単位の整数演算が必要になる
>
> **導線**
>
> - 開始地点: `code/ch05/i18n-utils.ts`
> - 模範解答: `code/ch05/i18n-utils.solution.ts`
>
> **推定時間の内訳**: 6関数のラッパ実装に35分、plural のカテゴリ分岐と置換に25分、複数ロケールでの出力比較と ICU 確認に30分
<!-- handbook:exercise:end -->

**要件**:

```typescript
// 数値フォーマット
formatNumber(1234567.89, 'ja-JP');           // "1,234,567.89"
formatCurrency(1500, 'JPY', 'ja-JP');        // "¥1,500"
formatCurrency(1500, 'USD', 'en-US');        // "$1,500.00"

// 日付フォーマット
formatDate(new Date(), 'ja-JP', 'short');    // "2026/05/20"
formatDate(new Date(), 'en-US', 'long');     // "May 20, 2026"
formatRelativeTime(-3, 'day', 'ja-JP');      // "3日前"

// 複数形 (Pluralization)
plural(0, 'en-US', { zero: 'no apples', one: '1 apple', other: '{n} apples' });
// → "no apples"
plural(5, 'en-US', { ... });  // → "5 apples"

// リスト整形
formatList(['Apple', 'Banana', 'Cherry'], 'en-US', 'conjunction');
// → "Apple, Banana, and Cherry"
formatList(['Apple', 'Banana', 'Cherry'], 'ja-JP', 'conjunction');
// → "Apple、Banana、Cherry"
```

模範解答: `code/ch05/i18n-utils.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":5} -->
### 第5章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第5章の模範解答をまとめて検証する
pnpm --filter @handbook/ch05 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch05 exec tsx my-promise.solution.ts       # 課題5.1
pnpm --filter @handbook/ch05 exec tsx run-async.solution.ts        # 課題5.2
pnpm --filter @handbook/ch05 exec tsx type-gymnastics.solution.ts  # 課題5.3
pnpm --filter @handbook/ch05 exec tsx typed-emitter.solution.ts    # 課題5.4
pnpm --filter @handbook/ch05 exec tsx i18n-utils.solution.ts       # 課題5.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch05/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-6"></a>
## 第6章 フロントエンドフレームワーク

第5章で、JavaScriptは状態を保持し、非同期処理を組み合わせ、関数を値として抽象化できることを確認した。だが、それらを使って状態変更のたびにDOM差分を手作業で更新すると、変更箇所の対応関係が画面全体へ散らばる。問題はJavaScriptの表現力不足ではなく、「状態からUIを一貫して導出する規則」がアプリケーションごとに手作業になっていることである。

本章では、この同期規則を共通化するためにフレームワークが導入した考え方を扱う。Reactの単方向データフロー、Vueのリアクティビティ、Svelteのコンパイル、Signalsは実装方法こそ異なるが、いずれも「どの状態変化が、どのUI更新を必要とするか」を追跡する仕組みである。ここでコンポーネント内部の更新を整理した後、第7章ではコンポーネントの境界を越える状態とサーバ状態を扱う。

なぜフロントエンドにフレームワークが必要なのか? 第4章のVanilla Todoを思い出してほしい。状態が変わるたびに全要素を作り直していた。1万件あれば1万要素の再生成 ― これでは実用にならない。

現代フレームワークは「**状態の宣言から、効率的なDOM更新を自動生成する**」ことで、この問題を解決する。

<!-- handbook:chapter-guide:start {"chapter":6} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> UI状態が増えたときのDOM同期、再利用、テスト、アクセシビリティを、フレームワークの抽象化とコストを理解して設計する。
>
> **到達目標**
> - 宣言的UI、単方向データフロー、リアクティビティの違いを説明できる。
> - React、Vue、Svelte、Signalsを要件とチーム条件で比較できる。
> - コンポーネント境界とアクセシビリティ要件を設計できる。
> - フォーカスを状態遷移として設計し、モーダル・動的更新・ルート遷移で失わないようにできる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [4.3 DOMの中身](02-part1-foundations.md#section-4-3) ― DOMの構造
> - [5.3 関数 ― First-class Citizen](#section-5-3) ― 関数とクロージャ
>
> **中核概念**  
> [6.1 Reactの登場と「単方向データフロー」](#section-6-1)、[6.2 仮想DOMの正体](#section-6-2)、[6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか](#section-6-4)、[6.5 Vue ― リアクティビティを中核に](#section-6-5) (実務選択)、[6.6 Svelte ― コンパイル時の最適化](#section-6-6) (実務選択)、[6.8 フレームワーク選択の現実的な指針](#section-6-8)、[6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI](#section-6-9)、[6.11 フォーカス管理 ― モーダル、動的更新、ルート遷移](#section-6-11) (実務選択)
>
> **最小実装**  
> [6.3 100行で作るミニReact](#section-6-3) (発展)、[6.12 実装課題 ― フロントエンドフレームワークの内側を作る](#section-6-12) (実務選択)
>
> **本番実装との差分**
> - ミニReactは再調停、並行レンダリング、エラー処理、イベント委譲、SSRを大幅に省略する。本番では公式実装とエコシステムを使う。
>
> **典型的な失敗**
> - 仮想DOMを常に高速化する魔法と考える。
> - 状態と派生値を重複保持する。
> - 見た目だけでアクセシビリティを判断する。
> - ARIA属性を付けたことをアクセシビリティ対応の完了と考え、フォーカスの行き先を設計しない。
>
> **診断・デバッグ方法**
> - React DevTools等で再レンダリング原因と状態所有者を確認する。
> - キーボード操作とスクリーンリーダーで主要フローを検証する。
> - Tabで一巡し、フォーカスの可視性、順序、閉じ込め、復帰を記録する。
>
> **意思決定チェックリスト**
> - チームの習熟、保守期間、SSR要件、エコシステムを満たすか。
> - 状態をどのコンポーネントが所有すべきか。
> - モーダルとルート遷移で、フォーカスをどこへ移し、どこへ戻すか。
>
> **演習と評価基準**  
> 対象: [6.12 実装課題 ― フロントエンドフレームワークの内側を作る](#section-6-12) (実務選択)
> - ミニフレームワークの更新経路を説明できる。
> - 同じ要件を複数方式で比較し、採用理由を書ける。
> - フォーカスの喪失とエラー未通知を再現し、対策後に再現しないことを示せる。
>
> **一次資料・発展資料**
> - React documentation
> - Vue documentation
> - Svelte documentation
> - WAI-ARIA Authoring Practices
> - W3C WAI-ARIA Authoring Practices Guide
<!-- handbook:chapter-guide:end -->

<a id="section-6-1"></a>
### 6.1 Reactの登場と「単方向データフロー」
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"R","term":"React"} -->

<!-- handbook:narrative-bridge {"section":"6.1"} -->
DOM APIだけでも画面は作れるが、状態変更と要素更新の対応を開発者が逐一維持しなければならない。Reactが導入した単方向データフローは、UIを命令列ではなく状態の結果として扱い、この対応関係を一方向へ制限する。

Reactは2013年にFacebookが公開した。当時のフロントエンドは jQuery で直接DOMを書き換えるか、AngularJSの双方向バインディングが主流だった。Reactが持ち込んだのは:

1. **コンポーネント指向**: UIを再利用可能な部品で構成
2. **宣言的記述**: 「状態Sのとき、UIはUI(S) である」と書く (DOM操作の手続きを書かない)
3. **単方向データフロー**: 状態の変更 → 再描画。逆向きは起こらない
4. **仮想DOM**: 状態変化のたびに「次のUI」を計算し、実DOMとの差分だけ反映

```tsx
// React: 状態を変えるだけで、画面が自動更新される
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

`setCount(count + 1)` を呼ぶと、React は「次のUIは何か」を計算し、変わった部分だけDOMに反映する。開発者はDOM操作を書かない。

<a id="section-6-2"></a>
### 6.2 仮想DOMの正体
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"R","term":"React"} -->
<!-- handbook:index {"group":"か行","term":"仮想DOM"} -->

<!-- handbook:narrative-bridge {"section":"6.2"} -->
状態からUIを再計算する方針は分かりやすいが、毎回DOM全体を書き直すのは高コストである。仮想DOMは宣言的な再計算と実DOMの最小更新を両立させるため、前回と今回の木構造の差分を求める。

「仮想DOMは速い」と長らく信じられてきたが、これは半分嘘だ。仮想DOMは**速いのではなく、扱いやすい**。

仮想DOMの本体は、JSX が変換された後の単なるJavaScriptオブジェクトだ。

```tsx
const element = <h1 className="title">Hello</h1>;
// ↓ Babel/SWC が変換
const element = React.createElement('h1', { className: 'title' }, 'Hello');
// ↓ 評価結果
const element = {
  type: 'h1',
  props: { className: 'title', children: 'Hello' },
  // ...
};
```

つまり仮想DOMとは「**UIを記述するプレーンオブジェクトの木**」だ。Reactはこの木と前回の木を比較 (diff) して、変更点だけを実DOMに適用する (この処理を **reconciliation** と呼ぶ)。

**diff アルゴリズム:**

完全な木の diff はO(n³) で実用にならない。Reactは妥協してO(n) アルゴリズムを使う:

1. 異なる type の要素は、木ごと作り直す (`<div>` → `<span>` なら子も全部作り直し)
2. 同じ type なら属性を比較して差分を適用
3. リストの子要素は **key** を使って同一性を判定

key の重要性:

```tsx
// BAD: index を key にすると、先頭への追加で全要素を更新してしまう
{todos.map((todo, i) => <li key={i}>{todo.text}</li>)}

// GOOD: 安定したIDを使う
{todos.map(todo => <li key={todo.id}>{todo.text}</li>)}
```

<a id="section-6-3"></a>
### 6.3 100行で作るミニReact
<!-- handbook:learning {"level":"advanced","minutes":25} -->
<!-- handbook:index {"group":"H","term":"Hooks (React)"} -->
<!-- handbook:index {"group":"R","term":"React"} -->

<!-- handbook:narrative-bridge {"section":"6.3"} -->
仮想DOMの概念を知るだけでは、コンポーネント呼び出し、要素生成、差分適用がどこでつながるかは分からない。最小実装を通じて、宣言的UIが実際のDOM操作へ変換される経路を一本につなぐ。

仮想DOMとreconciliationを理解するため、最小限のReact風ライブラリを書く。

```typescript
// mini-react.ts

// 仮想DOMノード
type VNode = {
  type: string | Function;
  props: Record<string, any>;
  children: (VNode | string)[];
};

// createElement (JSX を変換した結果)
function h(
  type: string | Function,
  props: Record<string, any> | null,
  ...children: (VNode | string)[]
): VNode {
  return { type, props: props ?? {}, children: children.flat() };
}

// VNode を実DOM に変換 (初回マウント)
function mount(vnode: VNode | string, container: HTMLElement): Node {
  if (typeof vnode === 'string') {
    const text = document.createTextNode(vnode);
    container.appendChild(text);
    return text;
  }

  // 関数コンポーネントは展開して再帰
  if (typeof vnode.type === 'function') {
    const rendered = vnode.type({ ...vnode.props, children: vnode.children });
    return mount(rendered, container);
  }

  const el = document.createElement(vnode.type);
  // 属性の適用
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'className') {
      el.setAttribute('class', value);
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of vnode.children) mount(child, el);
  container.appendChild(el);
  return el;
}

// diff & patch (簡略版: 子のkey なしリストを順次比較)
function patch(oldVNode: VNode | string, newVNode: VNode | string, parent: HTMLElement, index = 0) {
  const existing = parent.childNodes[index];

  // テキストノードの更新
  if (typeof newVNode === 'string') {
    if (typeof oldVNode !== 'string' || oldVNode !== newVNode) {
      parent.replaceChild(document.createTextNode(newVNode), existing);
    }
    return;
  }
  if (typeof oldVNode === 'string') {
    parent.replaceChild(document.createTextNode(''), existing);
    mount(newVNode, parent);
    return;
  }

  // type が異なれば作り直し
  if (oldVNode.type !== newVNode.type) {
    parent.removeChild(existing);
    mount(newVNode, parent);
    return;
  }

  // 属性の差分適用
  const el = existing as HTMLElement;
  const allKeys = new Set([...Object.keys(oldVNode.props), ...Object.keys(newVNode.props)]);
  for (const key of allKeys) {
    const oldV = oldVNode.props[key];
    const newV = newVNode.props[key];
    if (oldV === newV) continue;
    if (key.startsWith('on')) {
      const eventName = key.slice(2).toLowerCase();
      if (oldV) el.removeEventListener(eventName, oldV);
      if (newV) el.addEventListener(eventName, newV);
    } else if (newV == null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key === 'className' ? 'class' : key, String(newV));
    }
  }

  // 子要素の再帰的 diff (key なし: 単純に index 順比較)
  const maxLen = Math.max(oldVNode.children.length, newVNode.children.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldVNode.children.length) {
      mount(newVNode.children[i], el);
    } else if (i >= newVNode.children.length) {
      el.removeChild(el.childNodes[i]);
    } else {
      patch(oldVNode.children[i], newVNode.children[i], el, i);
    }
  }
}

// 簡易 useState (グローバル状態として実装、本物の React はもっと巧妙)
let currentComponent: { hooks: any[]; index: number } | null = null;
let scheduleRerender: (() => void) | null = null;

function useState<T>(initial: T): [T, (v: T) => void] {
  const comp = currentComponent!;
  const i = comp.index++;
  if (comp.hooks[i] === undefined) comp.hooks[i] = initial;
  const setter = (v: T) => {
    comp.hooks[i] = v;
    scheduleRerender?.();
  };
  return [comp.hooks[i], setter];
}

// アプリケーションの実行
function createApp(rootComponent: () => VNode, container: HTMLElement) {
  const componentState = { hooks: [] as any[], index: 0 };
  let prevVNode: VNode | null = null;

  const render = () => {
    currentComponent = componentState;
    componentState.index = 0;
    const newVNode = rootComponent();
    if (prevVNode === null) {
      mount(newVNode, container);
    } else {
      patch(prevVNode, newVNode, container, 0);
    }
    prevVNode = newVNode;
    currentComponent = null;
  };

  scheduleRerender = () => queueMicrotask(render);
  render();
}

// 使ってみる
function Counter(): VNode {
  const [count, setCount] = useState(0);
  return h('div', null,
    h('button', { onClick: () => setCount(count - 1) }, '-'),
    h('span', { style: 'margin: 0 1rem' }, String(count)),
    h('button', { onClick: () => setCount(count + 1) }, '+'),
  );
}

createApp(Counter, document.getElementById('app') as HTMLElement);
```

この実装には大きな省略がある:

- **コンポーネントツリーが1階層のみ**: 本物の React はコンポーネントごとに hooks スタックを保持
- **key なしの単純 diff**: React は key のマップと配置インデックスの比較で移動を抑える。Vue 3 は LIS (Longest Increasing Subsequence) で移動回数を最小化する。実装によって戦略が違う
- **同期更新**: 本物は scheduler によりタスクの優先度を制御 (Concurrent Mode)
- **エラー境界、Suspense、Context などは実装なし**

それでも、この100行から「仮想DOM + reconciliation + useState」のエッセンスは見える。

<a id="section-6-4"></a>
### 6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"H","term":"Hooks (React)"} -->

<!-- handbook:narrative-bridge {"section":"6.4"} -->
レンダリングはUIを再構築できるが、再レンダリングをまたいで状態を保持する必要がある。Hooksは関数コンポーネントの外へ状態スロットを保存し、呼び出し順序によって各スロットを対応付ける仕組みである。

React Hooks には独特のルールがある:

- ループや条件分岐の中で呼んではいけない
- トップレベルでのみ呼ぶ
- 関数コンポーネント (または他のフック) からのみ呼ぶ

なぜか? Reactは、フックを**名前ではなく呼ばれた順番で識別している**からである。

コンポーネントごとに状態の配列を1本持ち、`useState` が呼ばれるたびに先頭から順に添字を進めて、その位置の値を返す。おおよそ次のような仕組みになっている (本物は連結リストだが、識別の考え方は同じである)。

```tsx
// レンダリングのたびに index を 0 へ戻し、呼ばれた順に取り出す
let hooks: unknown[] = [];
let index = 0;

function useState<T>(initial: T) {
  const i = index++;                      // 「何番目の呼び出しか」だけが手がかり
  hooks[i] ??= initial;
  const setState = (value: T) => { hooks[i] = value; rerender(); };
  return [hooks[i] as T, setState] as const;
}
```

変数名 `x` や `y` はどこにも保存されていない。保存されているのは「1番目の状態」「2番目の状態」だけである。だから呼び出し順序が変わると、前回とは別の位置の値が返ってくる。

```tsx
// BAD: 条件によって呼び出すフックの数が変わる
function Bad({ enabled }: { enabled: boolean }) {
  if (enabled) {
    const [x, setX] = useState(0);  // 条件で増減する
  }
  const [y, setY] = useState(0);  // y のインデックスが変動する
}

// GOOD: 常に同じ順序で呼ぶ
function Good({ enabled }: { enabled: boolean }) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  // 条件は内部のロジックで対応
}
```

<a id="section-6-5"></a>
### 6.5 Vue ― リアクティビティを中核に
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"V","term":"Vue"} -->
<!-- handbook:index {"group":"さ行","term":"双方向データバインディング"} -->

<!-- handbook:narrative-bridge {"section":"6.5"} -->
Reactは再レンダリングと差分計算で更新箇所を導く。別の方法として、値がどこで読み取られたかを記録し、変更時に依存先だけを更新する設計がある。Vueのリアクティビティはこの依存追跡を中心に据える。

Vue 3 はReactとは異なる思想を採用している。**Proxyベースのリアクティビティ**だ。

```typescript
import { reactive, effect } from '@vue/reactivity';

const state = reactive({ count: 0 });

effect(() => {
  console.log(`count is ${state.count}`);
});

state.count++;  // "count is 1" が自動で出力される
```

`reactive()` は内部で Proxy を使い、プロパティアクセスを追跡。`effect()` が初回実行されるとき「どのプロパティを読んだか」を記録し、それらのプロパティが変更されたとき自動再実行される。これがVueのテンプレートが自動更新する仕組み。

Reactとの根本的な違い:

- **React**: 状態が変わったら、コンポーネント関数を**全部**再実行して新しい仮想DOMを作り、diff する。明示的なメモ化 (`useMemo`、`memo`) で最適化
- **Vue**: 状態の依存関係を追跡し、変わったところだけ再計算。明示的なメモ化は基本不要

どちらが優れているという話ではなく、設計トレードオフだ。

<a id="section-6-6"></a>
### 6.6 Svelte ― コンパイル時の最適化
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"S","term":"Svelte"} -->

<!-- handbook:narrative-bridge {"section":"6.6"} -->
実行時に依存関係を追跡する方法でも、ブラウザ上には更新機構のコードが残る。Svelteはコンパイル時に更新箇所を解析し、必要なDOM操作へ変換することで、同じ問題をビルド段階へ移す。

Svelteはコンパイラを中心に設計され、コンポーネントをビルド時に解析して、必要な更新コードを生成する。実行時コードが完全に存在しないわけではなく、ランタイム支援の量や方式はバージョンと機能によって異なる。

```svelte
<script>
  let count = 0;
</script>

<button on:click={() => count++}>
  Count: {count}
</button>
```

これがコンパイルされると、状態更新に対応するDOM更新処理が生成される。React型の仮想DOM reconciliationを中心に置かないことが特徴だ。最終的なバンドルサイズは、利用機能、依存関係、コード分割、ビルド設定に左右される。

Svelte 5以降は **Runes** という新しいリアクティビティシステムを採用し、`$state`、`$derived` などの構文で明示的にリアクティブを宣言する設計に移行している。

<a id="section-6-7"></a>
### 6.7 Signals ― リアクティビティの新潮流
<!-- handbook:learning {"level":"outlook","minutes":5} -->
<!-- handbook:index {"group":"S","term":"Signals"} -->

<!-- handbook:narrative-bridge {"section":"6.7"} -->
仮想DOM、実行時リアクティビティ、コンパイル時変換にはそれぞれ利点がある。Signalsは値単位の依存関係を明示的に持ち、細粒度更新をフレームワーク間で再利用しやすい形へまとめる。

SolidJS (2021年)、Preact Signals (2022年)、Vue 3 の `ref()`、Angular Signals (2023年) など、**Signal**と呼ばれるリアクティビティモデルを採用するフレームワークが増えた。

```typescript
import { signal, computed, effect } from '@preact/signals';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log(`doubled: ${doubled.value}`);
});

count.value++;  // "doubled: 2"
```

Signal の本質:

- 値はラッパー (`.value` でアクセス) になっている
- アクセス時に「現在実行中のeffect」を依存リストに登録
- 値の更新時に、依存している effect を再実行

これはVueの依存追跡と共通点があるが、Proxyではなく明示的な値コンテナを使う実装も多い。依存単位で更新を通知できるため、コンポーネント関数全体の再評価を中心とする方式とは、更新粒度とデバッグ特性が異なる。性能差はアプリ構造と測定条件に依存するため、ベンチマークだけで選ばない。

<a id="section-6-8"></a>
### 6.8 フレームワーク選択の現実的な指針
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"6.8"} -->
更新モデルの違いが分かると、フレームワーク選択を人気だけで決めずに済む。ここでは性能、学習コスト、エコシステム、長期保守という実務条件へ、各設計の特性を対応付ける。

フレームワークは採用率の順位ではなく、プロダクトとチームの制約で選ぶ。

| 評価軸 | 確認する内容 |
|---|---|
| チーム経験 | 採用・育成・レビューを継続できるか |
| レンダリング | CSR、SSR、静的生成、ストリーミングの要件を満たすか |
| エコシステム | ルータ、フォーム、テスト、a11y、国際化の必要機能があるか |
| 性能 | 実データと対象端末で計測したボトルネックに適合するか |
| 保守性 | メジャー更新、依存関係、長期サポートを受け入れられるか |
| 組織制約 | 既存資産、デザインシステム、ホスティング環境と統合できるか |

本書ではReactを主な例に使うが、これは教材全体で例を統一する著者判断であり、すべてのプロジェクトへの推奨ではない。

<a id="section-6-9"></a>
### 6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI
<!-- handbook:learning {"level":"required","minutes":25} -->
<!-- handbook:index {"group":"L","term":"Lighthouse"} -->
<!-- handbook:index {"group":"W","term":"WCAG"} -->
<!-- handbook:index {"group":"あ行","term":"アクセシビリティ (a11y)"} -->
<!-- handbook:index {"group":"さ行","term":"セマンティックHTML"} -->

<!-- handbook:narrative-bridge {"section":"6.9"} -->
更新方式を選んでも、生成されたUIがすべての利用者に操作可能とは限らない。アクセシビリティは後付けの装飾ではなく、DOM構造、フォーカス、入力手段を含むコンポーネント契約の一部である。

アクセシビリティ (a11y) は、視覚・聴覚・運動・認知などの特性や、利用する入力・出力手段にかかわらず、必要な情報と機能へアクセスできるUIを作る取り組みである。

倫理、利用可能性、品質の問題であると同時に、地域や提供サービスによって法的要件にもなり得る。適用法と達成基準は国・地域・業種で異なるため、実案件では法務・アクセシビリティ専門家と確認する。

#### a11y は利用状況の幅を広げる

アクセシビリティ改善は、障害の有無に限らず多様な状況で役立つ。

- **キーボード操作**は、マウスを使えない環境や熟練利用者にも有用
- **明確な見出しとラベル**は、支援技術だけでなく情報理解を助ける
- **十分なコントラスト**は、屋外や低品質なディスプレイでも読みやすい
- **字幕やテキスト代替**は、音を出せない環境でも利用できる

SEOへの影響は検索エンジンと実装に依存するため、アクセシビリティの目的や達成判定と混同しない。

#### WCAG (Web Content Accessibility Guidelines)

W3C勧告であるWCAG 2.2 (Web Content Accessibility Guidelines) [W3C WCAG, 2024] は、レベルA、AA、AAAの検証可能な達成基準を定義する。AAAはすべてのコンテンツへ一律に適用できる「理想レベル」という意味ではなく、適用可能性を確認して追加要件として扱う。法的な要求水準は制度ごとに確認する。

#### 実装の基本原則

**1. セマンティック HTML を使う**

```tsx
{/* BAD: div でボタンを作る */}
<div onClick={handleClick} style={{ cursor: 'pointer' }}>送信</div>

{/* GOOD: button 要素を使う */}
<button onClick={handleClick}>送信</button>
{/* これだけで、キーボード操作(Tab, Enter)、スクリーンリーダーの「ボタン」読み上げ、無効化(disabled)などが全て無料で動く */}
```

セマンティックHTMLは要素の役割、状態、標準操作をブラウザと支援技術へ伝える。重要な土台だが、適切な名前、フォーカス順序、エラー通知、状態変化、視覚設計などの確認も必要であり、要素を置き換えるだけで対応が完了するわけではない。

**2. キーボード操作可能にする**

すべての機能をマウスなしで操作できるべき。Tab で移動できるか、Enter / Space で起動するか、Escape でモーダルが閉じるか。

```tsx
function Modal({ isOpen, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // フォーカスを最初の要素へ
    dialogRef.current?.querySelector<HTMLElement>('[autofocus]')?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">確認</h2>
      {children}
      <button onClick={onClose} autoFocus>閉じる</button>
    </div>
  );
}
```

**3. ARIA (Accessible Rich Internet Applications) を必要なときだけ使う**

ARIA (Accessible Rich Internet Applications) は「HTML だけでは表現できない意味」を補う属性群。ただし**第一原則は「ARIA を使わなくて済むなら使わない」**。セマンティック HTML で十分なケースが大半。

ARIA が必要な場面:

- カスタムウィジェット (オートコンプリート、タブ、アコーディオン)
- 動的更新 (`aria-live` でスクリーンリーダーに通知)
- 状態 (`aria-expanded`、`aria-selected`、`aria-disabled`)

```tsx
// アコーディオン
function Accordion({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        aria-expanded={open}
        aria-controls="content-1"
        onClick={() => setOpen(!open)}
      >
        {title}
      </button>
      <div id="content-1" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

// トーストメッセージ
<div role="status" aria-live="polite">
  {message}
</div>
// → 「polite」なら他の読み上げが終わってから通知
// → 「assertive」なら割り込んで即通知 (エラー時)
```

**4. フォームのラベルとエラー**

```tsx
<form>
  <label htmlFor="email">メールアドレス</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'email-error' : undefined}
  />
  {errors.email && (
    <span id="email-error" role="alert">{errors.email}</span>
  )}
</form>
```

#### コントラスト比

文字と背景のコントラストは WCAG AA で **4.5:1 以上**(大きな文字は 3:1)。`#888` の文字を白背景に置くと 3.5:1 で違反 ― `#666` まで濃くする。デザインツール (Figma) のプラグインや、Chrome DevTools の Contrast Issues で検出可能。

#### a11y のテスト

```bash
# axe-core で自動検査
npm install -D @axe-core/react

# テスト
import { axe } from 'vitest-axe';

it('has no a11y violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**ツール:**

- **Lighthouse / axe**: 自動検出できるルールを確認
- **ブラウザのAccessibility Tree**: 名前・役割・状態を確認
- **NVDA / VoiceOver / TalkBack**: 実際の読み上げと操作を確認
- **キーボードのみの操作**: フォーカス順序、見失い、モーダル内の移動を確認

自動検査で検出できるのは問題の一部である。キーボード、拡大表示、スクリーンリーダー、実利用シナリオによる手動確認を組み合わせる。

#### 認知アクセシビリティも考える

- **ジャーゴンを避ける**: 平易な日本語 (やさしい日本語) で書く
- **タイムアウト**: 「30秒で自動ログアウト」は学習障害のユーザーに厳しい、延長ボタンを用意
- **アニメーション**: `prefers-reduced-motion` メディアクエリで動きを抑える
- **エラーは具体的に**: 「不正な値」ではなく「メールアドレスは @ を含む必要があります」

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

「全員に届くプロダクトを作る」は本質的に**良いプロダクトを作る**こととほぼ同じだ。

<a id="section-6-10"></a>
### 6.10 Web Components ― フレームワーク非依存の標準
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"C","term":"Custom Elements"} -->
<!-- handbook:index {"group":"L","term":"Lit (Web Components)"} -->
<!-- handbook:index {"group":"S","term":"Shadow DOM"} -->
<!-- handbook:index {"group":"W","term":"Web Components"} -->

<!-- handbook:narrative-bridge {"section":"6.10"} -->
フレームワーク内部で再利用できる部品を作れても、別のフレームワークや素のHTMLから利用できるとは限らない。Web Componentsは、カスタム要素とShadow DOMによって部品の境界をブラウザ標準へ移す。

React、Vue、Svelte ― 各フレームワークが「**コンポーネント**」という概念を持っているが、これらは互換性がない。React コンポーネントを Vue で使うことはできない。

ブラウザ標準としてこれを解決するのが **Web Components**。3つの仕様の組み合わせで成り立つ:

- **Custom Elements**: 独自の HTML タグを定義する API
- **Shadow DOM**: スタイルと DOM を隔離する仕組み
- **HTML Templates**: 再利用可能なテンプレートの宣言

#### Custom Elements の基本

```typescript
class MyCounter extends HTMLElement {
  private count = 0;
  private button: HTMLButtonElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        button { padding: 1rem; font-size: 1.5rem; }
      </style>
      <button>Count: 0</button>
    `;
    this.button = shadow.querySelector('button')!;
    this.button.addEventListener('click', () => this.increment());
  }

  // Lifecycle callbacks
  connectedCallback() {
    console.log('Mounted');
  }
  disconnectedCallback() {
    console.log('Unmounted');
  }
  attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    if (name === 'initial-count') this.count = parseInt(newVal, 10);
    this.render();
  }
  static observedAttributes = ['initial-count'];

  increment() {
    this.count++;
    this.render();
  }

  private render() {
    this.button.textContent = `Count: ${this.count}`;
  }
}

customElements.define('my-counter', MyCounter);
```

利用側はただの HTML:

```html
<my-counter initial-count="10"></my-counter>
```

これがフレームワークの種類を問わず動く。React の中でも、Vue の中でも、素の HTML でも。

#### Shadow DOM ― スタイル隔離

Shadow DOMでは、通常のセレクタによるスタイル指定が境界を越えない。内部スタイルも通常は外部要素へ適用されない。ただし継承されるプロパティ、CSSカスタムプロパティ、`:host`、`::part`、`::slotted`など、意図的に連携する仕組みがある。

```typescript
const shadow = this.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    /* このスタイルは外に漏れない */
    button { color: red; }
  </style>
  <button>クリック</button>
`;
```

これにより、セレクタ由来のグローバルな衝突を、ブラウザ標準の機構で防げる。CSS Modules や Scoped CSS が命名規約とビルドで解いていた問題に対応する。ただし継承されるプロパティ、カスタムプロパティ、`:host`、`::part`、`::slotted` は境界を越えるため、完全な遮断ではない。

**Slot による合成:**

```typescript
shadow.innerHTML = `
  <div class="card">
    <slot name="title"></slot>
    <slot></slot>
  </div>
`;
```

```html
<my-card>
  <h2 slot="title">タイトル</h2>
  <p>本文</p>
</my-card>
```

#### Web Components が向く用途

- **デザインシステム/UI ライブラリ**: 複数の Web アプリで再利用したい (Adobe Spectrum、Microsoft Fluent UI など)
- **マイクロフロントエンド**: 異なるチームが異なるフレームワークで作ったコンポーネントを統合
- **CMS/Marketing サイト**: HTML 中心のサイトに動的な要素を追加
- **長期保守が必要なプロダクト**: フレームワークの陳腐化を避けたい

YouTube は Web Components を本格採用している大規模事例。Adobe、SAP、salesforce.com も内部で活用。

#### React/Vue との関係

React 19ではCustom Elementsのプロパティやイベント連携が改善され、ReactツリーからWeb Componentsを利用しやすくなった。一方、Reactコンポーネントを自動的にCustom Elementへ変換する標準機能ではない。`@lit/react` (旧 `@lit-labs/react`) は主にLit製Custom ElementをReactコンポーネントとしてラップするためのライブラリである。

ReactやVueは状態管理、ルータ、テスト、採用市場を含む大きなエコシステムを持つ。一方、Web Componentsはフレームワーク間で共有するデザインシステムや埋め込み部品に適する。アプリケーション全体の基盤にするか、相互運用境界だけに使うかを要件から決める。

「**フレームワーク間の境界となる UI 部品**」が Web Components のスイートスポットと言える。

#### Lit ― Web Components開発を補助するライブラリ

ブラウザ標準だけで Web Components を書くのは煩雑なので、**Lit**(Google 製の軽量ライブラリ) がよく使われる:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('my-counter')
export class MyCounter extends LitElement {
  @property({ type: Number }) initialCount = 0;
  @state() private count = 0;

  static styles = css`
    button { padding: 1rem; font-size: 1.5rem; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.count = this.initialCount;
  }

  render() {
    return html`<button @click=${() => this.count++}>Count: ${this.count}</button>`;
  }
}
```

LitはCustom Elements、リアクティブプロパティ、テンプレート、スタイル定義の定型処理を補助する。サイズ比較は機能、圧縮、依存関係、アプリ構成で変わるため、実際のビルド成果物で評価する。Web標準との相互運用性を重視するプロジェクトでは有力な選択肢になる。

<a id="section-6-11"></a>
### 6.11 フォーカス管理 ― モーダル、動的更新、ルート遷移
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"は行","term":"フォーカス管理"} -->
<!-- handbook:index {"group":"は行","term":"フォーカストラップ"} -->
<!-- handbook:index {"group":"T","term":"tabindex"} -->
<!-- handbook:index {"group":"I","term":"inert 属性"} -->
<!-- handbook:index {"group":"あ行","term":"アクセシビリティツリー"} -->

<!-- handbook:narrative-bridge {"section":"6.11"} -->
6.10 の Shadow DOM は、スタイルとDOMの境界を部品ごとに閉じる。しかし境界を閉じても、フォーカスという単一の資源は文書全体で1つしかない。6.9 では `role` と `aria-*` で「何であるか」を伝える方法を見たが、キーボード利用者にとって決定的なのは「いま自分がどこにいるか」であり、これは属性ではなく**状態の遷移**として設計する必要がある。

フォーカスとは、キー入力を受け取る要素が文書内にただ1つ定まっている状態である。JavaScript からは `document.activeElement` で読める。マウス利用者にはほとんど意識されないが、キーボードだけで操作する利用者、スイッチデバイスの利用者、スクリーンリーダー利用者にとっては、フォーカスの位置が**画面上の現在地そのもの**である。

注意すべきは、スクリーンリーダーが読み上げている位置とフォーカス位置が必ずしも一致しないことである。多くのスクリーンリーダーは、フォーカスとは別に文書を読み進めるための独自のカーソルを持つ。したがって「フォーカスを移せば必ず読み上げられる」とも、「読み上げられている要素にフォーカスがある」とも仮定できない。設計で確実に制御できるのはフォーカス側だけであり、読み上げ側へは 7.9 で扱うライブリージョンを通じて別途伝える。

#### フォーカス可能性は3段階ある

要素がフォーカスを受け取れるかどうかは、次の3段階で決まる。

| 状態 | どうなるか | 指定方法 |
|---|---|---|
| 順序に含まれる | Tab で順に到達でき、`focus()` でも移せる | `a[href]`、`button`、`input`、`select`、`textarea`、`summary` などデフォルトでフォーカス可能な要素、または `tabindex="0"` |
| 順序に含まれないがフォーカスできる | Tab では止まらないが、`focus()` では移せる | `tabindex="-1"` |
| フォーカスできない | どちらもできない | 上記以外の要素、`disabled`、`inert` の配下、`display:none` / `visibility:hidden` の配下 |

`tabindex` に正の値 (`tabindex="1"` 以上) を指定すると、その要素は文書順より先に、指定した番号順で回る。**正の値は使わない。** 部品を追加した人が既存の番号を知らないため衝突し、再利用したときに順序が壊れる。順序を変えたいときは、DOM の並び順そのものを変える。CSS の `order` や `flex-direction: row-reverse` で見た目だけ入れ替えると、見えている順序と Tab の順序が食い違う。これは自動検査では検出しにくく、キーボードで一巡して初めて気づく類の不具合である。

`tabindex="-1"` は「プログラムからだけ移せる場所」を作るための道具であり、フォーカス管理の主役になる。移動先の見出し、エラーサマリ、削除後の代替位置などがこれにあたる。

#### フォーカスは必ず見えていなければならない

`outline: none` でフォーカスリングを消し、代わりの表示を用意しない、というのは最も多い不具合の1つである。マウス利用時に枠が出るのが不格好だという理由で消されることが多いが、その場合に使うのは `:focus-visible` である。

```css
/* すべてのフォーカスから枠を消してしまう。使わない */
:focus { outline: none; }

/* キーボード操作など「表示すべき」とブラウザが判断したときだけ枠を出す */
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* 高コントラストモードでは色指定が上書きされる。太さは残す */
@media (forced-colors: active) {
  :focus-visible { outline: 3px solid CanvasText; }
}
```

`:focus-visible` の判定はブラウザが行う。おおむね、キーボードで到達した場合と、テキスト入力欄のように文字入力を受け付ける要素には表示され、ポインタでボタンを押した場合には表示されない。判定の細部は実装によって差があるため、キーボードで一巡して実際に見えることを確認する。

枠を独自の表示に置き換える場合は、コントラスト (6.9) と、要素が画面外へスクロールした場合の追従を確認する。`overflow: hidden` の中の要素にフォーカスが移ると、フォーカスされているのに見えない、という状態が起こりうる。

#### モーダルは4つの動作が揃って初めて成立する

モーダルダイアログは、フォーカス管理のすべての要素が現れる題材である。6.9 では `role="dialog"` と `aria-modal="true"` を付ける形を見たが、属性は「これはモーダルである」と宣言するだけで、実際の閉じ込めは行わない。必要なのは次の4つである。

1. **開く前のフォーカス位置を記憶する** ― たいていは開くきっかけになったボタン。
2. **開いたらフォーカスを中へ移す** ― 最初の操作対象、または見出し (`tabindex="-1"`)。
3. **開いている間は外へ出さない** ― Tab / Shift+Tab が背後の要素へ抜けない。
4. **閉じたら記憶した位置へ戻す** ― 戻し先が消えている場合の代替も決めておく。

4番目が抜けると、閉じた瞬間にフォーカスが `body` へ落ちる。その状態で Tab を押すと文書の先頭から数え直しになり、利用者は「どこから来たか」を失う。長い一覧の途中で操作していた場合、元の位置へ戻るには数十回の Tab が必要になる。

HTML の `dialog` 要素を `showModal()` で開くと、3と、Escape での閉じる動作、そして背後の内容を操作不能にする処理をブラウザが引き受ける。1・2・4 はアプリケーション側の責任として残る。

```typescript
type DialogController = { open: () => void; close: () => void };

export function createModal(dialog: HTMLDialogElement): DialogController {
  let returnTo: HTMLElement | null = null;

  const open = () => {
    // 1. 戻り先を記憶する。activeElement は開いた瞬間に評価する
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // 2. 中へ移す。操作対象が無い告知だけのダイアログでは見出しへ移す
    const target =
      dialog.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.querySelector<HTMLElement>('h1, h2, h3');
    target?.focus();
  };

  const close = () => {
    dialog.close();
  };

  // 4. 戻す。Escape で閉じた場合も close イベントを通るため、ここに一本化する
  dialog.addEventListener('close', () => {
    const fallback = document.querySelector<HTMLElement>('main h1');
    const destination = returnTo?.isConnected ? returnTo : fallback;
    destination?.focus();
    returnTo = null;
  });

  return { open, close };
}
```

`returnTo?.isConnected` の判定が要る理由は、「削除ボタンで確認ダイアログを開き、削除を実行して閉じる」という流れでは、戻り先のボタン自体が消えているためである。消えた要素に `focus()` を呼んでも何も起きず、フォーカスは `body` に落ちる。代替の移動先 (一覧の見出し、親のセクション) をあらかじめ決めておく。見出しはデフォルトではフォーカスできないため、移動先にする見出しには `tabindex="-1"` を付ける。

`dialog` を使わず自前で作る場合は、3の閉じ込めを自分で実装する必要がある。

```typescript
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), summary, [tabindex]:not([tabindex^="-"])';

export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  // 毎回数え直す。開いている間に中身が増減するため、開いた時点の配列は使えない
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
  if (items.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
```

自前の閉じ込めには限界がある。ブラウザのアドレスバーへ移動するキー操作、開発者ツール、拡張機能の UI へは介入できないし、するべきでもない。閉じ込めるのは文書内の Tab 移動だけである。また、フォーカス可能な要素の集合を選択子で表現する方法は、Shadow DOM (6.10) の中の要素を拾えない。`dialog` と `inert` に任せられるならそちらを使う。

#### `aria-hidden`、`inert`、`display:none` は別物

背後の内容を「無いことにする」方法は3つあり、効果が違う。

| 方法 | 支援技術から | フォーカスから | ポインタ操作から |
|---|---|---|---|
| `display:none` / `visibility:hidden` | 隠れる | 外れる | 外れる |
| `aria-hidden="true"` | 隠れる | **外れない** | 外れない |
| `inert` | 隠れる | 外れる | 外れる (見た目は残る) |

最も危険なのは、フォーカス可能な要素を含む領域に `aria-hidden="true"` だけを付ける形である。Tab を押すと、支援技術には存在しないことになっている要素にフォーカスが移る。スクリーンリーダー利用者から見ると、何も読み上げられないまま入力位置だけが移動し、現在地が完全に失われる。背後を無効化したいときは `inert` を使う。`inert` は配下のフォーカス可能性、クリック、テキスト選択をまとめて外し、支援技術からも隠す。

自分自身にフォーカスがある要素、あるいはその祖先に `aria-hidden="true"` を付けてはならない。これは axe などの自動検査でも検出できる典型例である (25.11)。

#### ルート遷移と動的更新でフォーカスを落とさない

サーバから新しい文書を受け取る通常の画面遷移では、ブラウザがフォーカスを文書の先頭へ戻す。クライアント側ルーティング (9.1) では文書が入れ替わらないため、この処理は起きない。リンクを押した瞬間に消えた要素と一緒にフォーカスが落ち、新しい画面の内容は読み上げられない。

対処は、遷移完了後に移動先を明示することである。

```typescript
// ルート遷移が完了したときに呼ぶ
export function focusAfterNavigation(): void {
  const heading = document.querySelector<HTMLElement>('main h1');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus();
  // フォーカスを外したら属性も外す。残すとマウス操作時に不要な枠が出る実装がある
  heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
}
```

移動先として見出しではなく `main` 要素そのものを選ぶ方式もある。どちらでも、遷移後に何が読み上げられるかを実機で確認して決める。あわせて、画面名の通知をライブリージョンで行う方式 (7.9) を併用する実装も多い。

一覧から項目を削除する場合も同じ問題が起きる。削除ボタンを押すとボタンごと消えるため、フォーカスは `body` へ落ちる。

- 次の項目があるなら、その項目の同じ役割のボタンへ移す。
- 最後の項目を削除したなら、1つ前の項目へ移す。
- 項目が無くなったなら、一覧の見出しか「項目がありません」の表示へ移す。

無限スクロールや遅延読み込みでは、逆に**フォーカスを動かさない**ことが重要になる。読み込み完了のたびにフォーカスが先頭へ戻ると、キーボード操作は事実上不可能になる。新しく増えたことの通知はライブリージョンで行い、フォーカスは利用者が置いた場所に留める。

**フォーカスを勝手に奪わない**という原則は、`autofocus` にも当てはまる。検索ページのように、画面を開く目的が入力そのものである場合を除き、読み込み直後の自動フォーカスは、それより上にある情報を読み飛ばさせる。

#### Tab はウィジェット間、矢印はウィジェット内

「すべての操作対象を Tab で回れるようにする」は、一見親切だが、項目数が多い部品では逆効果になる。20個のタブがある画面で、目的のタブへ行くまでに20回 Tab を押すことになるためである。

WAI-ARIA Authoring Practices [W3C APG] が示す慣習は、Tab を**複合ウィジェットの間**の移動に使い、ウィジェットの内側は矢印キーで移動させる、というものである。実装としては、ウィジェット内で `tabindex="0"` を持つ要素を常に1つだけにし、矢印キーの操作でその1つを移し替える (ロービング `tabindex`)。

| 部品 | Tab | 矢印 | その他 |
|---|---|---|---|
| タブ | ウィジェット全体で1回止まる | 左右でタブを切り替える | Home / End で端へ |
| メニュー | 開くボタンで止まる | 上下で項目を移動 | Escape で閉じてボタンへ戻す |
| ツリー | ウィジェット全体で1回止まる | 上下で移動、左右で開閉 | ― |
| ラジオボタン群 | 選択中の1つで止まる | 上下左右で選択を移す | ― |
| 一覧・表 | 個々のリンクやボタンで止まる | ブラウザデフォルト | ― |

最後の行が示すように、すべてを複合ウィジェット化する必要はない。リンクとボタンが並んでいるだけの一覧は、Tab で回れるほうが素直である。矢印キーの実装を選ぶのは、項目数が多く、かつ「同種のものから1つ選ぶ」という関係が明確な場合に限る。

独自のキー操作を足すときは、既存の操作を奪っていないかを確認する。テキスト入力欄の中で上下キーを乗っ取ると、カーソル移動ができなくなる。Escape をアプリ全体で握ると、ブラウザや支援技術側の取り消し操作と衝突しうる。

#### つまずく箇所 ― フォーカス管理

- **`outline: none` を全体に当てる**: キーボード利用者は現在地を完全に失う。`:focus-visible` で表示条件を絞るか、同等以上に見える代替を用意する。
- **モーダルを閉じたあとの戻し先を決めていない**: 削除の確認ダイアログのように、戻り先自体が消える流れを必ず確認する。
- **フォーカス可能な要素を含む領域に `aria-hidden` だけを付ける**: 読み上げられない要素にフォーカスが入る。`inert` を使う。
- **`tabindex` に正の値を使う**: 部品の再利用と追加のたびに順序が壊れる。DOM の順序で表現する。
- **見た目の順序を CSS だけで入れ替える**: Tab の順序と視覚順序が食い違う。自動検査では拾えない。
- **クライアント側ルーティングで移動先を指定しない**: 遷移したことも、遷移先の内容も伝わらない。
- **読み込みのたびにフォーカスを先頭へ戻す**: 無限スクロールでキーボード操作が成立しなくなる。通知はライブリージョンで行う (7.9)。
- **フォーカス可能な要素の一覧を開いた時点で確定させる**: 開いている間に中身が増減する部品では、閉じ込めが抜ける。判定のたびに数え直す。

<a id="section-6-12"></a>
### 6.12 実装課題 ― フロントエンドフレームワークの内側を作る
<!-- handbook:learning {"level":"practical","minutes":450} -->

<!-- handbook:narrative-bridge {"section":"6.12"} -->
本章で比較した更新モデルは、抽象度が高いほど内部差が見えにくい。ミニ実装では、状態変更がどの追跡機構を通り、どのDOM操作へ到達するかを実際に確かめる。

第6章では仮想 DOM、Hooks、Signals、Web Components など、現代フロントエンドの中核を学んだ。本節では、自分でこれらの「ミニ版」を作ることで、フレームワーク内部の動作原理を完全に理解する。所要時間: 演習カードの推定時間の合計で12時間15分 (中級〜上級者向け)。

#### 課題6.1: 100行ミニReact + Hooks (★★★)

**目的**: 6.3 でミニ React の核を示したが、本課題ではそれに**useState、useEffect、useMemo、useRef**を追加する。

<!-- handbook:exercise:start {"id":"6.1"} -->
> **演習カード 課題6.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 6.3 100行で作るミニReact を読み、createElement とレンダリングループの骨格を把握しておく
> - 6.4 Hooks の仕組み ― なぜ呼び出し順序が重要なのか を読み、フック状態が呼び出し順の配列で管理される理由を説明できる状態にする
> - 5.3 関数 ― First-class Citizen を読み、クロージャで状態を閉じ込める書き方に慣れておく
> - `pnpm --filter @handbook/ch06 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch06/mini-react/mini-react.ts` に `createMiniReact(component)` と `useState` / `useEffect` / `useMemo` / `useRef` を実装する
> - [ ] フック状態を呼び出し順のインデックス配列で保持し、`render()` を繰り返しても各フックが自分のスロットを取り戻す
> - [ ] `useRef` が返すオブジェクトが再レンダリング後も同一参照で、`current` の増分が積み上がる
> - [ ] `useEffect` は依存配列が変化したときだけ再実行され、再実行の前に前回のクリーンアップが呼ばれる
> - [ ] `dispose()` で登録済みエフェクトのクリーンアップがすべて実行される
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch06 run test` が全件パスする
>
> **期待出力**
>
> - テスト `mini React keeps hook order and runs effect cleanup` が pass する
> - 初回 `render()` の戻り値が `{ count: 0, doubled: 0, renders: 1 }` になる
> - setState 後にマイクロタスクを1回待ってから `render()` すると `{ count: 1, doubled: 2, renders: 3 }` が返る
> - エフェクトのログが `effect:0`、`cleanup:0`、`effect:1` の順に並び、`dispose()` 後の最後の要素が `cleanup:1` になる
>
> **観察項目**
>
> - `useState` を `if` の中に入れて条件によって呼ばれないようにし、フック添字がずれて別スロットの値が返ることを実際に観察する
> - setState をマイクロタスクでまとめる処理を同期実行へ変え、`renders` の回数がどう増えるかを比較する
> - `useMemo` の依存配列を `[]` に固定し、count が変わっても doubled が更新されなくなることを確認する
> - 同じ値で setState を呼んだときに再レンダリングが走るかどうかを、`renders` の増分で確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch06 run test` を実行し、mini React のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch06 run typecheck` を実行し、フックの戻り値型 (`[T, (next: T) => void]` など) でエラー0件なら合格
> 3. コンポーネント内で `useState` を2つに増やし、`render()` を3回呼んでも両方の値が独立に保たれれば、スロット管理が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: フックは「現在レンダリング中のコンポーネントを指すグローバル変数」と「そのコンポーネントが持つ状態配列」の2つだけで成立する。まず useState 1本に絞って、render のたびに添字を0へ戻す仕組みを作る
> 2. **構造**: ランタイムを `MiniReactRuntime` クラスにして、`hooks: unknown[]`、`cursor: number`、`render()`、`dispose()` を持たせる。`useEffect` は依存配列とクリーンアップ関数を同じスロットへ格納し、`depsChanged(before, after)` で比較する
> 3. **実装の要点**: setState はその場で再レンダリングせず `queueMicrotask` で1回にまとめる。同期再帰させると、レンダリング中の setState で無限ループになる
>
> **本番利用時の警告**
>
> - このミニ実装は DOM への差分適用、イベント委譲、エラーバウンダリ、並行レンダリングを持たない。実 UI へ載せると更新の取りこぼしとエフェクトの二重実行が起きる
> - フック状態をモジュールスコープのグローバル変数で持つため、複数コンポーネントを同時にレンダリングすると状態が混線する。本番では React の公式実装を使う
>
> **導線**
>
> - 開始地点: `code/ch06/mini-react/mini-react.ts`
> - 模範解答: `code/ch06/mini-react/mini-react.solution.ts`
>
> **推定時間の内訳**: ランタイムと useState のスロット管理に45分、useEffect のクリーンアップと依存比較に50分、useMemo/useRef の追加とテスト・観察に55分
<!-- handbook:exercise:end -->

**要件**: `MiniReact` ライブラリを実装し、以下のコンポーネントが動くこと:

```typescript
import { MiniReact, useState, useEffect, useMemo } from './mini-react';

function Counter() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  // 副作用
  useEffect(() => {
    document.title = `Count: ${count}`;
    return () => { document.title = 'Default'; };
  }, [count]);

  // メモ化
  const doubled = useMemo(() => count * 2, [count]);

  return MiniReact.createElement('div', {},
    MiniReact.createElement('h1', {}, `${text} - Count: ${count}, Doubled: ${doubled}`),
    MiniReact.createElement('input', {
      value: text,
      onInput: (e) => setText(e.target.value),
    }),
    MiniReact.createElement('button', {
      onClick: () => setCount(c => c + 1),
    }, 'Increment'),
  );
}

MiniReact.render(MiniReact.createElement(Counter, {}), document.getElementById('root'));
```

**評価基準**:
- フックの順序が保たれる (useState の順序ルールが守られる)
- 再レンダリングで状態が保持される
- useEffect のクリーンアップが正しく呼ばれる
- 依存配列が正しく機能 (値が変わったときのみ再実行)

模範解答: `code/ch06/mini-react/mini-react.solution.ts`

#### 課題6.2: Signals ベースのリアクティブシステム (★★★)

**目的**: SolidJS や Vue 3 の Composition API で使われる Signals を自作する。React の VDOM とは異なる「**直接的な反応**」のアプローチを実装。

<!-- handbook:exercise:start {"id":"6.2"} -->
> **演習カード 課題6.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 6.7 Signals ― リアクティビティの新潮流 を読み、依存の自動追跡と push 型更新の考え方を把握しておく
> - 6.5 Vue ― リアクティビティを中核に を読み、getter 経由の依存収集という発想に触れておく
> - `Set` と `Map` を使った双方向の参照管理をコードで書ける
> - `pnpm --filter @handbook/ch06 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch06/signals.ts` に `createSignal` / `computed` / `effect` を実装し、`createSignal` は getter と setter のタプルを返す
> - [ ] effect 内で読んだ signal が自動的に依存として登録され、依存の明示宣言が不要になる
> - [ ] `Object.is` で同値と判定された set では effect が再実行されない
> - [ ] `effect()` の戻り値の dispose 関数を呼ぶと、以後どの signal を更新しても再実行されない
> - [ ] effect の実行中に自分が読む signal を set する直接循環を検出し、`cycle` を含むメッセージの例外を投げる
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch06 run test` が全件パスする
>
> **期待出力**
>
> - テスト `signals track dependencies and skip equal values` と `signals reject direct cycles` の2件が pass する
> - count を 1 で初期化し 1 へ set、その後 2 へ set、dispose 後に 3 へ set した場合、effect が記録した配列が `[2, 4]` になる
> - 循環を作る effect を登録すると `/cycle/i` にマッチするエラーが throw される
> - computed は依存が変わるまで再計算されず、複数回読んでもキャッシュ済みの値が返る
>
> **観察項目**
>
> - 「現在実行中の effect」を保持するグローバル変数を effect の入口と出口で console.log し、ネストした effect で退避と復帰が起きることを確認する
> - effect の再実行前に古い依存集合をクリアする処理を外し、条件分岐で読む signal を切り替えたときに不要な依存が残り続けることを確認する
> - computed のキャッシュを外して素の関数にし、同じ effect 内で2回読んだときの計算回数の差を数える
> - 1つの signal に10個の effect を張り、set 1回で何回の再実行が発生するかを数えてバッチ処理の必要性を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch06 run test` を実行し、signals の2テストが pass すれば合格
> 2. `pnpm --filter @handbook/ch06 run typecheck` を実行し、`Signal<T>` のタプル型でエラー0件なら合格
> 3. 条件分岐で読む signal を切り替える effect を書き、切り替え後に旧依存を更新しても再実行されなければ依存の再収集が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 依存追跡の本体は「signal の getter が呼ばれた瞬間に、いま走っている effect を自分の購読者集合へ足す」という一行に集約される。まずグローバル変数1つと Set 1つで最小構成を作る
> 2. **構造**: effect を `ReactiveEffect` クラスにして `deps: Set<Set<Subscriber>>`、`run()`、`dispose()` を持たせる。run の冒頭で旧依存を全て解除してから自分を activeEffect に設定し、finally で元へ戻す
> 3. **実装の要点**: 循環検出は `running` フラグ1つで足りる。run 中にもう一度 run が呼ばれたら throw する。フラグの解除を finally に置かないと、例外時に effect が永久に実行不能になる
>
> **本番利用時の警告**
>
> - effect の再実行時に旧依存を解除しないと、購読者集合が単調増加してメモリリークになる。長寿命の画面ではこの実装のまま使わない
> - バッチ処理とスケジューラを持たないため、set を連続で呼ぶと effect が呼び出し回数分だけ同期実行される。大量更新のあるリストに適用すると UI が固まる
>
> **導線**
>
> - 開始地点: `code/ch06/signals.ts`
> - 模範解答: `code/ch06/signals.solution.ts`
>
> **推定時間の内訳**: signal と effect の依存追跡に50分、computed のキャッシュ実装に40分、同値スキップと循環検出、観察記録に60分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log(`count: ${count()}, doubled: ${doubled()}`);
});
// 初回: "count: 0, doubled: 0"

count.set(1);
// 自動的に: "count: 1, doubled: 2"

count.set(5);
// 自動的に: "count: 5, doubled: 10"
```

**ヒント**:
- `signal()` は読み書きできる原始値
- `computed()` は他の signal/computed から派生 (キャッシュされる)
- `effect()` は signal が変わると自動再実行
- グローバルな「現在実行中の effect」を追跡することで依存関係を自動収集

**評価基準**:
- 依存関係の自動追跡 (明示宣言不要)
- 不要な再実行を避ける (値が同じなら effect 実行しない)
- 循環参照を検出してエラーにする (発展)

模範解答: `code/ch06/signals.solution.ts`

#### 課題6.3: Diff アルゴリズム (VDOM Reconciler)(★★★)

**目的**: React の根幹である「2つの VDOM ツリーを比較して、最小の DOM 操作を導く」アルゴリズムを実装する。

<!-- handbook:exercise:start {"id":"6.3"} -->
> **演習カード 課題6.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 6.2 仮想DOMの正体 を読み、差分計算と DOM 操作の分離という前提を把握しておく
> - 6.3 100行で作るミニReact を読み、VNode の構造 (type、props、children、key) に慣れておく
> - TypeScript の判別可能ユニオン型 (`{ type: 'MOVE'; ... }` の形) を読み書きできる
> - `pnpm --filter @handbook/ch06 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch06/vdom-diff.ts` の `diff(oldNode, newNode, path)` が DOM を直接操作せず `Patch[]` を返す
> - [ ] `CREATE` / `REMOVE` / `REPLACE` / `TEXT` / `PROPS` / `MOVE` の6種のパッチ型を判別可能ユニオンとして定義する
> - [ ] type が異なるノードで `REPLACE`、文字列の差分で `TEXT`、props の差分で set と remove を持つ `PROPS` が出る
> - [ ] key 付きの子を並び替えたとき `MOVE` が出て、`REPLACE` が0件になる
> - [ ] 変更のないサブツリーに対してパッチが1件も出ない
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch06 run test` が全件パスする
>
> **期待出力**
>
> - テスト `VDOM diff updates only changed nodes and emits keyed moves` が pass する
> - key が a、b の2要素リストを b、a へ並び替え、b のテキストだけ変えたとき、`MOVE` が2件、`TEXT` が1件、`REPLACE` が0件になる
> - パッチの `path` が `0`、`0.1` のようなドット区切りのツリー座標で出力される
> - `PROPS` パッチは新規・変更されたキーを `set` に、消えたキーを `remove` の配列に持つ
>
> **観察項目**
>
> - key を外して同じ並び替えを diff にかけ、MOVE が消えて全要素の TEXT や REPLACE に化けることを確認する
> - 1000要素のリストのうち1要素だけを書き換えた入力を作り、返るパッチ件数が1〜2件に収まることを `patches.length` で確認する
> - 子の追加・削除・並び替えを同時に含む入力を与え、REMOVE の path が旧インデックス基準であることを確認する
> - props の値をオブジェクトにして毎回新しい参照を渡し、`Object.is` 比較では毎回 PROPS パッチが出てしまうことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch06 run test` を実行し、VDOM diff のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch06 run typecheck` を実行し、`Patch` ユニオンの網羅性でエラー0件なら合格
> 3. 同一の VNode ツリーを old と new に渡して `diff` を呼び、返る配列が空 (`length === 0`) なら無駄なパッチが出ていない
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に「同じ位置の2ノードを比べる」1段だけを書く。undefined 同士、文字列同士、type 違い、type 同じ、の4分岐を潰してから子の照合へ進む
> 2. **構造**: 子の照合は key をキーにした `Map` を旧配列から作り、新配列を走査して一致を引く。key の無い子には `#index:${i}`、テキストには `#text:${i}` のような合成キーを割り当てると分岐が1本化できる
> 3. **実装の要点**: MOVE を出すのは実キーを持つ子だけにする。合成キーの子まで MOVE 対象にすると、単なる挿入で全要素が移動扱いになりパッチが爆発する
>
> **本番利用時の警告**
>
> - この diff はパッチ列を返すだけで適用器を含まない。パッチの path をそのまま DOM へ適用する場合、MOVE と REMOVE の適用順を誤ると参照する子インデックスがずれてツリーが壊れる
> - props を `Object.is` で浅く比較するため、毎回生成されるオブジェクトやインライン関数を props に渡すと差分が常に発生する。本番のリコンサイラのように優先度制御や中断も行わないため、大規模ツリーではメインスレッドを長時間占有する
>
> **導線**
>
> - 開始地点: `code/ch06/vdom-diff.ts`
> - 模範解答: `code/ch06/vdom-diff.solution.ts`
>
> **推定時間の内訳**: ノード単位の4分岐実装に40分、key 付き子の照合と MOVE 生成に60分、props 差分とパッチ件数の観察に50分
<!-- handbook:exercise:end -->

**要件**:

```typescript
type VNode = {
  type: string | ((props: any) => VNode);
  props: Record<string, any>;
  children: (VNode | string)[];
  key?: string | number;
};

// diff(old, new, parentDOM) で DOM を差分更新
function diff(oldVNode: VNode, newVNode: VNode, parentDOM: HTMLElement): void { /* TODO */ }
```

**処理ケース**:
- type が違う → 置換
- type が同じ → props と children を比較
- 子の追加 / 削除 / 並び替え (key を使う)
- テキストノードは別扱い

**評価基準**:
- 1000 要素の更新時に、変わった要素だけ DOM 操作される
- key 付きリストで並び替えても要素が再利用される
- 余計な再レンダリングをしない

模範解答: `code/ch06/vdom-diff.solution.ts`

#### 課題6.4: Web Components で型安全な Counter (★★)

**目的**: 標準 Web Components で再利用可能なコンポーネントを作る。HTML 側でも、別フレームワーク側でも使える。

<!-- handbook:exercise:start {"id":"6.4"} -->
> **演習カード 課題6.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 6.10 Web Components ― フレームワーク非依存の標準 を読み、カスタム要素のライフサイクルコールバックを把握しておく
> - 6.9 アクセシビリティ (a11y) ― 全ての人に届けるUI を読み、`aria-label` とキーボード操作の要件を確認しておく
> - 静的ファイルを HTTP で配信する手段 (`python3 -m http.server` など) が使える
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch06/web-component-counter/starter/main.html` に `class MyCounter extends HTMLElement` を実装し、`customElements.define('my-counter', MyCounter)` で登録する
> - [ ] `static observedAttributes = ['initial', 'step']` を宣言し、`<my-counter initial="10" step="2">` が初期表示 10、増加ボタン1回で 12 になる
> - [ ] `attachShadow({ mode: 'open' })` の中に `<style>` を置き、ページ側の `button { }` ルールが内部ボタンへ届かない
> - [ ] `value` の getter と setter を定義し、`counter.value = 50` で表示が 50 へ更新される
> - [ ] 値が実際に変わったときだけ `CustomEvent('change', { detail: { value }, bubbles: true })` を発火し、同じ値の代入では発火しない
> - [ ] 増減ボタンに `aria-label` を付け、Tab でフォーカスして Enter または Space で値を変更できる
>
> **期待出力**
>
> - `<my-counter initial="10" step="2">` が 10 を表示し、増加ボタン1回で 12、減少ボタン1回で 10 に戻る
> - change イベントの `event.detail.value` に新しい数値が入り、ページ側の `<output>` が同じ値へ更新される
> - 属性を持たない `<my-counter>` は initial 0、step 1 として描画される
> - DevTools の Elements で要素の下に `#shadow-root (open)` が現れ、その中に style と3つの子要素が並ぶ
>
> **観察項目**
>
> - DevTools の Elements パネルで shadow root を開き、ページ側に書いた `button { background: red }` が内部ボタンへ適用されないことを確認する
> - コンソールで `document.querySelector('my-counter').setAttribute('step', '5')` を実行し、attributeChangedCallback が呼ばれて次のクリックから増分が変わることを確認する
> - `counter.value = counter.value` を実行し、change イベントのリスナーが発火しないことをログで確認する
> - 要素を `remove()` してから再度 `append` し、connectedCallback が再実行されて初期化が走ることを確認する
> - `initial="abc"` のような非数値属性を与え、`Number.isFinite` の検証でフォールバック値になることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `python3 -m http.server 8080 --directory code/ch06/web-component-counter/solution` を起動し、`http://localhost:8080/main.html` で模範解答の挙動を先に確認してから自作版と比較する
> 2. 自作版を同じ手順で開き、ブラウザのコンソールで `document.querySelector('my-counter').value = 50` を実行して表示が 50 になり change が1回だけ発火すれば合格
> 3. キーボードだけで操作し、Tab でボタンにフォーカスが移り Enter または Space で値が step 分だけ増減すれば a11y 要件を満たす
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 属性 (HTML から与える文字列) とプロパティ (JavaScript から与える値) は別物として設計する。まず属性を読んで描画するところまでを作り、プロパティ経由の更新は後から足す
> 2. **構造**: constructor で `attachShadow` して `innerHTML` にテンプレートを流し込み、`root.querySelector('[part=value]')` などの参照を private フィールドへ保持する。値の更新は setter に集約し、setter の中から描画とイベント発火を行う
> 3. **実装の要点**: constructor では属性をまだ読まない。DOM パーサが属性を設定する前に呼ばれる場合があるため、`initial` と `step` の読み取りは connectedCallback で行う。ここを間違えると initial が常に 0 になる
>
> **本番利用時の警告**
>
> - Shadow DOM はスタイルの隔離であってセキュリティ境界ではない。テンプレートを `innerHTML` で組み立てる実装のまま、外部由来の文字列を差し込むよう拡張すると XSS になる。属性値は必ず数値へ変換・検証してから使う
> - この実装は form-associated custom elements (ElementInternals) と SSR 時の描画を扱わない。そのまま業務フォームへ載せるとフォーム送信に値が含まれず、サーバ側で欠落する
>
> **導線**
>
> - 開始地点: `code/ch06/web-component-counter/starter/main.html`
> - 模範解答: `code/ch06/web-component-counter/solution/main.html`
>
> **推定時間の内訳**: カスタム要素と Shadow DOM の骨組みに30分、属性・プロパティ・イベントの往復実装に40分、a11y 確認と模範解答との比較に20分
<!-- handbook:exercise:end -->

**要件**:

```html
<my-counter initial="10" step="2"></my-counter>
<my-counter initial="100"></my-counter>

<script>
  const counter = document.querySelector('my-counter');
  counter.addEventListener('change', (e) => {
    console.log('New value:', e.detail.value);
  });
  counter.value = 50;  // プログラムから値を設定
</script>
```

**要件**:
- カスタム要素 `<my-counter>` を定義
- 属性 `initial` と `step` を解析
- Shadow DOM で内部スタイル隔離
- value プロパティで読み書き可能
- 値変更時にカスタムイベント発火
- アクセシビリティ対応 (`role`、`aria-*`)

模範解答: `code/ch06/web-component-counter/` ディレクトリ

#### 課題6.5: フレームワーク比較ベンチマーク (★)

**目的**: 「同じUI」を3通りで実装し、コード行数・パフォーマンスを比較する。

<!-- handbook:exercise:start {"id":"6.5"} -->
> **演習カード 課題6.5** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: localhost
>
> **前提**
>
> - 課題6.1 と課題6.2 を終え、ミニReact と Signals の実装が手元で動く状態にしておく
> - 6.8 フレームワーク選択の現実的な指針 を読み、比較軸が性能だけではないことを確認しておく
> - `bash` と `wc` が使え、`code/ch06/benchmark/solution/main.sh` を実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch06/benchmark/starter/main.sh` を書き換え、少なくとも3方式の所要時間をそれぞれ1行で出力する
> - [ ] 3方式で同じ作業量 (同じ要素数・同じ更新回数) を測っており、その条件をスクリプト内のコメントに明記している
> - [ ] 同じスクリプトを3回以上実行し、最速値と中央値を記録している
> - [ ] `wc -l` で各実装のコード行数を数え、実行時間と行数を並べた比較メモを作っている
> - [ ] どの方式がどの条件で有利かを、計測値を根拠に3文以上で書き出している
>
> **期待出力**
>
> - `mutable-array`、`immutable-copy`、`signal-style` のように、方式名・ミリ秒・結果値を含む行が3行出力される
> - 毎回配列全体をコピーする方式は、繰り返し回数を他方式より大幅に減らしてもなお所要時間が最も長くなる
> - 同じスクリプトを続けて2回実行すると、2回目の方が速い値になる回がある
> - 終了コードが0で、途中でエラー出力が出ない
>
> **観察項目**
>
> - 1回目と2回目以降の実行時間を比べ、JIT のウォームアップと GC が測定値に混ざることを確認する
> - 繰り返し回数を10倍にして、時間が線形に伸びる方式とそれ以上に伸びる方式を切り分ける
> - Node 上の計測には DOM 更新コストが含まれないことを確認し、ブラウザでの再計測が別途必要な理由をメモに残す
> - コード行数の少なさと実行速度が一致しないケースを見つけ、どちらを優先すべきかを条件付きで整理する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch06/benchmark/solution/main.sh` を実行し、3方式の行がミリ秒付きで出力されれば実行環境は正常
> 2. 自作版を `bash code/ch06/benchmark/starter/main.sh` で実行し、3行の計測結果が出て `echo $?` が 0 なら合格
> 3. `wc -l code/ch06/mini-react/mini-react.solution.ts code/ch06/signals.solution.ts` で行数を取得し、比較表の行数欄が実測値で埋まっていれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に「何を揃えるか」を決める。要素数、更新回数、測定の開始と終了位置を3方式で同一にしないと、あとの数値がすべて比較不能になる
> 2. **構造**: 計測は `performance.now()` で開始と終了を挟み、`toFixed(2)` でミリ秒を出力する。方式名を固定幅で `padEnd` すると、3行の出力がそのまま比較表になる
> 3. **実装の要点**: 1回だけの測定値は使わない。同じ関数を3回以上回して中央値を取る。ウォームアップ用に捨てる1回を先頭に入れると、JIT の影響が数値から抜ける
>
> **本番利用時の警告**
>
> - この計測は単一プロセスの Node 上で行われ、GC、JIT ウォームアップ、CPU 周波数変動を制御していない。この数値だけを根拠に本番の最適化を決めると、効果のない箇所を書き換えることになる
> - 3方式の勝敗をそのままフレームワーク選定の根拠にしない。実アプリの差はDOM更新量、バンドルサイズ、チームの習熟度で決まるため、ブラウザ上での再計測と非機能要件の確認が必要になる
>
> **導線**
>
> - 開始地点: `code/ch06/benchmark/starter/main.sh`
> - 模範解答: `code/ch06/benchmark/solution/main.sh`
>
> **推定時間の内訳**: 既存スクリプトの読解と実行に10分、条件を揃えた自作計測の追加に20分、3回実行と行数計測・比較メモ作成に15分
<!-- handbook:exercise:end -->

**実装するUI**: 1000行のテーブル、各セルがクリックで色変化、フィルタ入力で動的絞り込み

3バージョン:
1. Vanilla TypeScript(課題4.2の延長)
2. ミニReact(課題6.1)
3. Signals(課題6.2)

**問題**: 初期レンダリング時間、フィルタ入力時の再レンダリング時間、コード行数を比較せよ。どの方式がどんなときに有利か論じよ。

模範解答: `code/ch06/benchmark/`

---

#### 課題6.6: フォーカスとエラー通知の欠落を再現して塞ぐ (★★★)

**目的**: 6.11 のモーダルの4つの動作と、7.9 のエラーの3経路が欠けた状態を実際に再現し、実装を差し替えると同じ検査が1件も引っかからなくなることを確かめる。

<!-- handbook:exercise:start {"id":"6.6"} -->
> **演習カード 課題6.6** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 6.11 フォーカス管理 を読み、モーダルの4つの動作と inert と aria-hidden の違いを確認する
> - 7.9 フォームのアクセシビリティ を読み、エラーが載る3つの経路を押さえる
> - 6.9 アクセシビリティ (a11y) を読み、アクセシブルな名前とセマンティックHTMLの役割を確認する
> - `code/ch06` で pnpm install 済みで、`pnpm --filter @handbook/ch06 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `tabbables` が hidden と inert の配下、disabled、負の tabindex をいずれも Tab 順序から外す
> - [ ] `fixedDialog.open` が開く前のフォーカス位置を記憶し、ダイアログ内へ移し、背後を inert にする
> - [ ] `fixedDialog.close` が記憶した位置へ戻し、戻り先が消えている場合は見出しへ移す
> - [ ] `fixedForm.submit` がフィールド単位・エラーサマリ・フォーカス移動の3経路をすべて用意する
> - [ ] 正しい入力での送信が成功し、成功の通知が1件だけライブリージョンへ入る
> - [ ] `pnpm --filter @handbook/ch06 exec tsx a11y-focus/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive ui: 4/4 barriers reproduced` が出る
> - A1 の行が `naive focus=del-2 inside-dialog=false / fixed focus=confirm inside-dialog=true` になる
> - A2 の行が `naive escaped=6 first=del-3 / fixed escaped=0 first=none` になる
> - A3 の行が `naive after-close=(body) / fixed after-close=page-title` になる
> - 最終行が `fixed ui: 0/4 barriers remaining (valid submit still announced)` になる
>
> **観察項目**
>
> - `fixedDialog.open` から inert の設定を外し、A2 だけが再現に戻る (fixed escaped=5) ことを確認する
> - `naiveDialog.open` へ inert だけを足し、A2 は解消するが A1 が残る (naive 3/4、escaped=0) ことを確認する
> - `naiveDialog.open` へフォーカス移動だけを足し、A1 は解消するが A2 が残る (naive 3/4、escaped=5) ことを確認する
> - `focusAfterDelete` の deleteItem の呼び出しを外し、A3 の fixed が after-close=del-2 になることを確認する
> - `fixedForm` のフォーカス移動先を error-summary から submit に変え、A4 だけが再現に戻ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch06 exec tsx a11y-focus/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch06 run test` を実行し、a11y-focus の4件のテストが pass することを確認する
> 3. 自分の `a11y-focus/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch06 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 判定の入口を tabbables に一本化する。到達できるかどうかも、閉じ込められているかどうかも、フォーカスの復帰先が使えるかどうかも、すべて同じ集合から導けるようにすると、どこか1か所だけ古い判断が残るという誤りが起きなくなる。
> 2. **構造**: モーダルの4つの動作を、開くときの3つと閉じるときの1つに分けて考える。開くときは「記憶する」「移す」「外を止める」の順で、閉じるときは「隠す」「外の停止を解く」「戻す」の順である。閉じ込めを属性で表現できていれば、Tab の処理そのものは全体を巡回するだけで済む。
> 3. **実装の要点**: フォームは、エラーの文字列が支援技術へ届く経路を3つ用意する。入力欄からは aria-describedby で、まとめからは件数を含む見出しとリンクで、そして通知はサマリへフォーカスを移すことで行う。3つ目が無いと、送信ボタンにフォーカスがある利用者には何も起きていないように見える。
>
> **本番利用時の警告**
>
> - この文書モデルは実ブラウザの一部を模したものにすぎない。フォーカス可能な要素の集合、inert の効果、支援技術の読み上げ位置は実装によって異なる。25.11 のキーボード走査と支援技術での確認を必ず併用する。
> - ここでの「読み上げに届いた」判定は、名前・説明・ライブリージョン・フォーカス先の内容という4経路の文字列一致にすぎない。実際に理解できる文言かどうかは別に確認する。
> - アクセシビリティの適合水準を外部へ表明するかどうかは、技術的な判断だけでは決まらない。法務およびアクセシビリティの専門家に確認する (25.11、30.16)。
>
> **導線**
>
> - 開始地点: `code/ch06/a11y-focus/starter/main.ts`
> - 模範解答: `code/ch06/a11y-focus/solution/main.ts`、`code/ch06/a11y-focus/solution/report.ts`
>
> **推定時間の内訳**: tabbables と文書モデルの読解30分、fixedDialog の4動作40分、fixedForm の3経路40分、runFindings と観察40分
<!-- handbook:exercise:end -->

**題材**: ブラウザも支援技術も使わない。`El`(`id`・`tag`・属性・子) だけからなる最小の文書モデルと、`activeId`(いまフォーカスがある要素)、ライブリージョンへ書き込まれた文字列の履歴を持つ `Screen` を用意してある。この上で、Tab の移動、`inert` と `aria-hidden` の効果の違い、アクセシブルな名前の計算、`aria-describedby` の解決を再現する。25.11 の3層でいえば自動検査の層に相当し、キーボード走査と読み上げ確認の代わりにはならない。

**要件**: `code/ch06/a11y-focus/starter/main.ts` に次の4つを実装する。

1. `tabbables(root)` ― Tab で到達できる要素を文書順に返す。`hidden` と `inert` の配下、`disabled`、負の `tabindex` はいずれも外す。
2. `fixedDialog.open` / `close` ― 6.11 の4つの動作 (記憶・移動・閉じ込め・復帰) を実装する。`naiveDialog` は「属性で宣言するだけ」の実装として与えてある。
3. `fixedForm.submit` ― 7.9 の3経路 (フィールド単位・エラーサマリ・通知) を実装する。エラーが無いときは成功をライブリージョンへ出す。
4. `runFindings()` ― 4件について `naive` と `fixed` の観測値を集める。

再現する4件は次のとおりである。

| 番号 | 誤り | `naive` で起きること |
|---|---|---|
| A1 `focus-not-moved` | 開いてもフォーカスを中へ移さない | 押したボタンにフォーカスが残り、ダイアログの内容へ到達できない |
| A2 `focus-escapes` | 背後を `aria-hidden` にするだけで `inert` にしない | Tab が背後の要素へ抜け、読み上げられない要素に入力位置が移る |
| A3 `focus-not-restored` | 閉じたときの戻し先を決めていない | 戻り先のボタンごと消えるため、フォーカスが `body` へ落ちる |
| A4 `error-not-announced` | エラーを描画するだけで、どの経路にも載せない | 送信ボタンにフォーカスがある利用者には何も起きていないように見える |

A3 は「削除の確認ダイアログで、削除を実行してから閉じる」という流れで再現する。戻り先が消えている場合に代替の移動先を持つかどうかが、`naive` と `fixed` の唯一の差である。

**評価基準**:

- 同じ `runFindings` が、`naive` 側では 4/4、`fixed` 側では 0/4 になる
- A2 が、`aria-hidden` ではなく `inert` を使ったことで解消する
- A3 の戻し先が、消えた要素ではなく `tabindex="-1"` を付けた見出しになる
- A4 が、フォーカスの移動によって支援技術へ届く経路に載る
- 正しい入力での送信が `fixed` 側でも成功し、成功の通知が1件だけ入る (過剰な対策をしていない)

```text
naive ui: 4/4 barriers reproduced
  A1 focus-not-moved: naive focus=del-2 inside-dialog=false / fixed focus=confirm inside-dialog=true
  A2 focus-escapes: naive escaped=6 first=del-3 / fixed escaped=0 first=none
  A3 focus-not-restored: naive after-close=(body) / fixed after-close=page-title
  A4 error-not-announced: naive delivered=false / fixed delivered=true
fixed ui: 0/4 barriers remaining (valid submit still announced)
```

模範解答: `code/ch06/a11y-focus/solution/`

<!-- handbook:code-usage:start {"chapter":6} -->
### 第6章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第6章の模範解答をまとめて検証する
pnpm --filter @handbook/ch06 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch06 exec tsx mini-react/mini-react.solution.ts  # 課題6.1
pnpm --filter @handbook/ch06 exec tsx signals.solution.ts                # 課題6.2
pnpm --filter @handbook/ch06 exec tsx vdom-diff.solution.ts              # 課題6.3
open code/ch06/web-component-counter/solution/main.html                  # 課題6.4
bash code/ch06/benchmark/solution/main.sh                                # 課題6.5
pnpm --filter @handbook/ch06 exec tsx a11y-focus/solution/main.ts        # 課題6.6
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch06/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。

`open` は macOS のコマンドである。Linux では `xdg-open`、Windows では `start` を使う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-7"></a>
## 第7章 状態管理とデータフェッチング

第6章で、コンポーネントは状態からUIを導出する単位になった。しかし、アプリケーション全体では、状態の寿命と所有者が同じとは限らない。入力中の値は一つの画面に閉じる一方、ログイン情報は複数画面で共有され、APIから取得したデータはサーバ側でも変化する。これらをすべて同じ仕組みへ押し込むと、更新責務とキャッシュ責務が混ざり、再取得やロールバックの判断が難しくなる。

本章では、状態をローカル状態・共有クライアント状態・サーバ状態へ分け、それぞれに適した所有方法を導く。Redux、Zustand、Jotai、TanStack Queryを製品名の比較としてではなく、どの種類の状態問題を解く設計なのかとして整理する。状態の流れを明確にした後、第8章では、増えたモジュールと依存関係をブラウザへ効率よく届ける問題へ進む。

フロントエンドの複雑さの大半は「状態管理」に起因する。本章では状態管理の系譜と、サーバ状態 (data fetching) の扱いを整理する。

<!-- handbook:chapter-guide:start {"chapter":7} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> UI状態、共有状態、サーバ状態を混在させた結果生じる古い表示、競合、過剰なグローバル状態を解消し、フォームの状態を支援技術へ届く形へ変換する。
>
> **到達目標**
> - 状態をローカル・共有・サーバに分類できる。
> - キャッシュの鮮度、再取得、楽観的更新、ロールバックを設計できる。
> - フォーム状態とバリデーション境界を設計できる。
> - フォームの名前、必須、エラー、送信結果を、視覚以外の経路へも届けられる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [6.1 Reactの登場と「単方向データフロー」](#section-6-1) ― 単方向データフロー
> - [5.4 非同期処理の進化](#section-5-4) ― 非同期処理
>
> **中核概念**  
> [7.1 状態の3分類](#section-7-1)、[7.4 サーバ状態の特殊性](#section-7-4)、[7.5 TanStack Query (React Query) ― サーバ状態管理の代表例](#section-7-5)、[7.6 楽観的更新 (Optimistic Update)](#section-7-6)、[7.7 リアクティブな状態とフォーム](#section-7-7)、[7.9 フォームのアクセシビリティ ― 名前、エラー通知、送信の結果](#section-7-9) (実務選択)
>
> **最小実装**  
> [7.2 Flux と Redux ― 単方向データフローの徹底](#section-7-2) (実務選択)、[7.10 実装課題 ― 状態管理の核を作る](#section-7-10) (実務選択)
>
> **本番実装との差分**
> - 教材ストアとキャッシュは購読解除、永続化、競合制御、エラー回復、SSR統合を簡略化している。
>
> **典型的な失敗**
> - サーバデータを複数ストアへコピーする。
> - 楽観的更新で失敗時の復元を設計しない。
> - 入力中と送信済み状態を区別しない。
> - エラーを描画するだけで、フォーカスもライブリージョンも使わず通知しない。
>
> **診断・デバッグ方法**
> - Networkログとキャッシュキーを照合する。
> - 状態更新の発生元、購読先、再描画を時系列で記録する。
> - 空のまま送信し、エラーがフィールド・サマリ・通知の3経路に載るか確認する。
>
> **意思決定チェックリスト**
> - 状態の正本はどこか。
> - 共有範囲は本当にアプリ全体か。
> - 再取得と無効化の条件は何か。
> - 検証をいつ走らせるか。入力中、blur時、送信時のどれをデフォルトにするか。
>
> **演習と評価基準**  
> 対象: [7.10 実装課題 ― 状態管理の核を作る](#section-7-10) (実務選択)
> - 状態分類を説明し、適切な保存場所を選べる。
> - 失敗する楽観的更新を再現し復元できる。
> - ラベルとエラー通知の欠落を再現し、修正後に読み上げ経路へ載ることを示せる。
>
> **一次資料・発展資料**
> - Redux documentation
> - TanStack Query documentation
> - HTML forms specification
> - W3C WAI-ARIA Authoring Practices Guide
<!-- handbook:chapter-guide:end -->

<a id="section-7-1"></a>
### 7.1 状態の3分類
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"L","term":"localStorage"} -->
<!-- handbook:index {"group":"ら行","term":"ローカルストレージ"} -->

<!-- handbook:narrative-bridge {"section":"7.1"} -->
コンポーネント単体の状態保持はHooksで扱えるが、状態ごとに寿命・共有範囲・正本の場所が異なる。最初に分類を誤ると、後からどのライブラリを選んでも責務が混線するため、所有者から整理する。

すべての状態を一緒くたに扱うのが混乱の元だ。実務では以下のように分けて考える。

1. **ローカル状態 (UI state)**: コンポーネント内の入力値、開閉状態、フォーカスなど
2. **共有状態 (Client state)**: アプリ内で複数の画面が共有する状態 (ログインユーザー情報、テーマ設定など)
3. **サーバ状態 (Server state)**: バックエンドから取得したデータ。キャッシュの鮮度、再取得、競合、失敗、共有元との同期を扱う必要がある

これらは性質が違うため、同じツールで扱うべきではない。

- ローカル → `useState` などコンポーネント内で完結
- 共有 → Zustand、Jotai、Redux、Context など
- サーバ → React Query (TanStack Query)、SWR、Apollo Client など

<a id="section-7-2"></a>
### 7.2 Flux と Redux ― 単方向データフローの徹底
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"R","term":"Redux"} -->

<!-- handbook:narrative-bridge {"section":"7.2"} -->
共有クライアント状態では、複数箇所から更新されると変更理由を追跡しにくい。FluxとReduxは更新入口と状態遷移を一方向へ集約し、履歴を観測可能にする。

Reactと同時期にFacebookが提唱した **Flux** アーキテクチャは、以下の流れで状態を更新する。

```text
[Action] → [Dispatcher] → [Store] → [View] → (新しいAction)
```

Reduxは Flux を簡略化・標準化したライブラリだ。

```typescript
// Redux の基本
type State = { count: number };
type Action = { type: 'increment' } | { type: 'decrement' } | { type: 'set'; value: number };

function reducer(state: State = { count: 0 }, action: Action): State {
  switch (action.type) {
    case 'increment': return { count: state.count + 1 };
    case 'decrement': return { count: state.count - 1 };
    case 'set':       return { count: action.value };
    default: return state;
  }
}

// 状態の更新は必ず dispatch(action) 経由
store.dispatch({ type: 'increment' });
```

Reduxの教訓:

- **状態変更が予測可能**: アクション → reducer → 新state、という単方向の流れ
- **デバッグしやすい**: Redux DevTools で全アクションを追跡、タイムトラベル可能
- **ボイラープレートが多い**: 一つの状態変更にアクション、reducer、ディスパッチャと多くの記述

2019年に登場した **Redux Toolkit** (RTK) でボイラープレートが減り、`createSlice` などの API で書きやすくなった。

<a id="section-7-3"></a>
### 7.3 軽量状態管理 ― Zustand と Jotai
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"Z","term":"Zustand"} -->

<!-- handbook:narrative-bridge {"section":"7.3"} -->
Reduxの明示性は大規模な共有状態に有効だが、小さなアプリでは定型コードが負担になる。ZustandやJotaiは、必要な共有範囲を保ちながら、ストアや依存単位をより小さく表現する。

ReduxよりシンプルなライブラリがReactエコシステムに登場した。

**Zustand**: store単位での状態管理。

```typescript
import { create } from 'zustand';

type Store = {
  count: number;
  increment: () => void;
  reset: () => void;
};

const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));

// コンポーネント内
function Counter() {
  const { count, increment } = useStore();
  return <button onClick={increment}>{count}</button>;
}
```

**Jotai**: 「atom」という最小単位で状態を構成。

```typescript
import { atom, useAtom } from 'jotai';

const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2);

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  const [doubled] = useAtom(doubledAtom);
  return (
    <>
      <p>Count: {count}, Doubled: {doubled}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </>
  );
}
```

Jotaiは Recoil の系譜で、状態を細かく分割することで「変更があった atom を使うコンポーネントだけ再描画」という最適化が自然にできる。

<a id="section-7-4"></a>
### 7.4 サーバ状態の特殊性
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"T","term":"TanStack Query"} -->

<!-- handbook:narrative-bridge {"section":"7.4"} -->
クライアント状態はアプリ内が正本だが、APIデータの正本はサーバにある。取得済みデータには鮮度、再取得、重複要求、失敗回復という時間的な問題が加わるため、通常の共有状態とは分ける必要がある。

クライアント状態は「アプリが持つ真実」だ。サーバ状態は「アプリが知る最後のスナップショット」に過ぎない。両者の本質的な違い:

- サーバ状態は**古くなる**: 別ユーザーが更新したかもしれない
- サーバ状態は**所有していない**: アプリの再起動で消える、再取得が必要
- 取得は**非同期**: ローディング、エラー、リトライの管理が必要
- 取得は**コスト**: 何度も同じデータを取得したくない

これらの本質的に難しい問題を、Redux などの汎用状態管理ライブラリで扱うのは無理がある。専用ツールが必要だ。

<a id="section-7-5"></a>
### 7.5 TanStack Query (React Query) ― サーバ状態管理の代表例
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"さ行","term":"楽観的更新"} -->

<!-- handbook:narrative-bridge {"section":"7.5"} -->
サーバ状態の問題を個別に実装すると、各画面にキャッシュと再取得のロジックが重複する。TanStack Queryは問い合わせキーを中心に、取得・鮮度・リトライ・無効化を共通化する。

React Query は次の概念を中心に設計されている:

- **クエリキー**: `['users', userId]` のような配列でデータを識別、キャッシュ
- **stale-while-revalidate**: 古くてもキャッシュを即返し、裏で再取得
- **自動再取得**: ウィンドウフォーカス時、ネットワーク復帰時、定期実行など
- **重複排除**: 同じクエリキーへの並行リクエストは1つに

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<User>;
    },
    staleTime: 60_000,  // 60秒間はキャッシュを「新鮮」とみなす
    retry: 3,           // 失敗時のリトライ回数
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <h1>{data.name}</h1>;
}
```

**ミューテーション (更新系):**

```tsx
function EditProfile({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newData: Partial<User>) =>
      fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      }).then(r => r.json()),
    onSuccess: () => {
      // ユーザー情報を再取得 (キャッシュ無効化)
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });

  return (
    <button
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ name: 'New Name' })}
    >
      Save
    </button>
  );
}
```

<a id="section-7-6"></a>
### 7.6 楽観的更新 (Optimistic Update)
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"7.6"} -->
再取得だけでは、操作のたびにサーバ応答を待つためUIが遅く感じられる。楽観的更新は成功を先取りして表示する代わりに、失敗時のロールバックと競合処理を明示的に設計する。

UIを高速に感じさせる定番のテクニック。サーバ応答を待たず、成功を仮定して画面を即更新する。

```tsx
function TodoList() {
  const queryClient = useQueryClient();
  const { data: todos } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/todos/${id}/toggle`, { method: 'POST' }),
    onMutate: async (id) => {
      // 進行中のクエリをキャンセル (競合防止)
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // 現在の値をスナップショット (ロールバック用)
      const previous = queryClient.getQueryData<Todo[]>(['todos']);

      // 楽観的に更新
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.map(t => t.id === id ? { ...t, done: !t.done } : t) ?? []
      );

      // ロールバック用の値を返す
      return { previous };
    },
    onError: (_err, _id, context) => {
      // 失敗したら元に戻す
      if (context?.previous) {
        queryClient.setQueryData(['todos'], context.previous);
      }
    },
    onSettled: () => {
      // 成功/失敗いずれにせよサーバの真実を再取得
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  return (
    <ul>
      {todos?.map(t => (
        <li key={t.id} onClick={() => toggleMutation.mutate(t.id)}>
          [{t.done ? 'x' : ' '}] {t.text}
        </li>
      ))}
    </ul>
  );
}
```

ポイント:

- `onMutate` で即UIを更新 (`setQueryData`)
- 失敗時のロールバック用に元の値を保存
- サーバが値を補正・採番する場合や他クライアントの更新を取り込みたい場合は、成功後に`invalidateQueries`で再取得する。API応答を信頼してキャッシュを直接確定できる場合は、必須とは限らない

<a id="section-7-7"></a>
### 7.7 リアクティブな状態とフォーム
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"は行","term":"フォーム"} -->

<!-- handbook:narrative-bridge {"section":"7.7"} -->
サーバ更新の流れを整理しても、フォームでは入力途中、検証結果、送信状態が高頻度に変化する。フォームは局所状態とサーバ状態が接触する境界であり、型と実行時検証を組み合わせる必要がある。

フォームの状態管理は意外と難しい。バリデーション、エラー表示、送信中の状態、ダーティチェックなど、考えることが多い。

代表的なライブラリ:

- **React Hook Form**: 非制御コンポーネントを使い、入力のたびの再描画を避ける設計
- **Formik**: 古参、シンプル
- **TanStack Form**: 型安全、ヘッドレス

```tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* placeholder はラベルの代わりにならない。入力を始めた瞬間に消え、
          支援技術にも項目名として伝わらない (6.9)。label を必ず結び付ける */}
      <label htmlFor="email">メールアドレス</label>
      <input id="email" {...register('email')} type="email" autoComplete="email"
             aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
      {errors.email && <span id="email-error" role="alert">{errors.email.message}</span>}

      <label htmlFor="password">パスワード</label>
      <input id="password" {...register('password')} type="password" autoComplete="current-password"
             aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />
      {errors.password && <span id="password-error" role="alert">{errors.password.message}</span>}

      <button type="submit" disabled={isSubmitting}>Login</button>
    </form>
  );
}
```

**zod** はTypeScript用のスキーマバリデーションライブラリ。**フロントとバックで同じスキーマを共有**できるのが強みだ (バックエンドでも同じスキーマでバリデーション可能)。

<a id="section-7-8"></a>
### 7.8 スタイリング戦略 ― CSS の設計思想の変遷
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"C","term":"CSS Modules"} -->
<!-- handbook:index {"group":"C","term":"CSS-in-JS"} -->
<!-- handbook:index {"group":"L","term":"Linaria"} -->
<!-- handbook:index {"group":"S","term":"shadcn/ui"} -->
<!-- handbook:index {"group":"S","term":"Styled-components"} -->
<!-- handbook:index {"group":"T","term":"Tailwind CSS"} -->
<!-- handbook:index {"group":"V","term":"Vanilla Extract"} -->
<!-- handbook:index {"group":"さ行","term":"スタイリング戦略"} -->

<!-- handbook:narrative-bridge {"section":"7.8"} -->
状態から正しい要素を生成できても、見た目の規則がグローバルに衝突すればコンポーネント境界は崩れる。スタイリング戦略は、CSSの適用範囲、再利用単位、実行時コストをどこで管理するかの選択である。

React や Vue の登場で「コンポーネントごとに HTML と JavaScript をまとめる」考え方が広まったが、CSS は長らくグローバルスコープのままだった。これに対応するアプローチが複数生まれ、選択は重要な設計判断になる。

#### 主要なスタイリング戦略

| 戦略 | 代表 | 特徴 |
|---|---|---|
| 命名規則 | BEM、SMACSS | 規約だけ、ツール不要 |
| CSS Modules | `*.module.css` | ローカルスコープ化、ツールが自動でクラス名をユニーク化 |
| CSS-in-JS (Runtime) | styled-components、Emotion | JavaScript の中に CSS、動的スタイル可、ランタイムコスト |
| CSS-in-JS (Zero-runtime) | Linaria、Vanilla Extract | ビルド時に CSS 化、ランタイムコストなし |
| Utility-First | Tailwind CSS | 既製のクラスを組み合わせる、HTMLが冗長になる |
| Headless UI + 自由なスタイル | Radix UI、shadcn/ui | アクセシビリティとロジックだけ提供、見た目は自由 |

#### CSS Modules

ファイル単位でクラス名をユニーク化:

```css
/* Button.module.css */
.primary {
  background: blue;
  color: white;
}
```

```tsx
import styles from './Button.module.css';

export function Button() {
  return <button className={styles.primary}>Click</button>;
  // 実際の出力: <button class="Button_primary__abc123">
}
```

シンプルでわかりやすい。ツール対応も成熟。

#### styled-components / Emotion (Runtime CSS-in-JS)

```tsx
import styled from 'styled-components';

const Button = styled.button<{ primary?: boolean }>`
  background: ${(p) => (p.primary ? 'blue' : 'white')};
  color: ${(p) => (p.primary ? 'white' : 'blue')};
  padding: 0.5rem 1rem;
`;

<Button primary>Click</Button>
```

**利点**: 動的スタイル、プロップス連動、テーマ機能
**注意**: ライブラリによっては実行時にスタイル生成・挿入を行うため、CPUコスト、キャッシュ、挿入順序、SSR時の抽出とハイドレーションを設計する必要がある。RSC (React Server Components) への対応はライブラリと利用方式によって異なる。

ランタイムでスタイルを生成する方式は、サーバコンポーネントの境界と相性が悪い。Next.js App Router で使う場合は、クライアント境界の切り方と、ライブラリ側の対応状況を採用前に確認する。

#### Linaria / Vanilla Extract (Zero-runtime CSS-in-JS)

```typescript
// styles.css.ts (Vanilla Extract)
import { style } from '@vanilla-extract/css';

export const button = style({
  background: 'blue',
  color: 'white',
  padding: '0.5rem 1rem',
});
```

```tsx
import * as styles from './styles.css';

<button className={styles.button}>Click</button>
```

**ビルド時にCSSファイルへ変換**するため、実行時のスタイル生成処理を減らせる。TypeScriptと統合できる製品もある。ただしブラウザのスタイル計算は必要であり、「CSSの実行コストがゼロ」になるわけではない。RSCとの統合可否はツールチェーンを確認する。

#### Tailwind CSS の Utility-First 思想

```html
<button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
  Click
</button>
```

「ユーティリティクラスを HTML に直接書く」アプローチ。最初は冗長に見えるが、慣れると速い。

**Tailwind の設計思想:**

- **CSS ファイルは育つもの**: アプリが成長するほど CSS が膨らむ問題を、ユーティリティの再利用で解決
- **コンポーネントを抽象化するのは適切なタイミングで**: 同じパターンを 3 回書いてから抽出
- **デザイントークンの強制**: `p-3` は 0.75rem、`p-4` は 1rem… と決まっており、デフォルトのスケールから外れる値は `p-[13px]` のように明示的な記法が要る。ずれた値が目に見えるため、スケールから外れたことに気づきやすい

**Tailwind の利点:**

- HTML だけ見れば見た目が分かる
- 命名のコスト (`.button-primary-outlined-large` 等) から解放
- 未使用クラスはビルド時に削除されるため、最終 CSS は数 KB
- shadcn/ui や Catalyst 等のヘッドレス UI とよく組み合わせられる

**批判もある:**

- HTML が読みにくい (クラスが長くなる)
- デザインシステムを自前で運用したい場合は不向き
- 「CSS が書けない人を量産する」という意見も

最終的にはチームで判断する。判断材料は、既存のスタイル資産、デザイナーとの受け渡し方法、レビューでクラス列を読めるか、の3点になる。

#### Headless UI + 自由スタイル (Radix / Headless UI / shadcn)

近ごろ増えている分担は **「アクセシビリティとロジックはライブラリへ、見た目は自前で」** という形である。

```tsx
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root>
  <Dialog.Trigger className="bg-blue-500 px-4 py-2">開く</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded">
      <Dialog.Title>確認</Dialog.Title>
      <Dialog.Description>続行しますか?</Dialog.Description>
      <Dialog.Close>キャンセル</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

Radix UI は WAI-ARIA 準拠、キーボード操作、フォーカストラップなどを内蔵。見た目は Tailwind で自由に。

**shadcn/ui** は、パッケージが内部実装を隠す方式ではなく、必要なコンポーネントコードを自分のリポジトリへ追加して管理する設計を採る。直接編集できる一方、取り込んだコードの更新、脆弱性対応、上流変更の追従は利用側の責任になる。採用可否は流行ではなく、この所有モデルを受け入れられるかで判断する。

#### 選択指針

| 要件 | 確認する点 |
|---|---|
| スコープ分離 | CSS Modules、Shadow DOM、命名規則のどれで境界を作るか |
| デザイントークン | 型検査、テーマ切替、他プラットフォームとの共有方法 |
| 動的スタイル | CSS変数や属性で足りるか、実行時生成が必要か |
| SSR / RSC | スタイル抽出、挿入順序、ストリーミング、CSPへの対応 |
| 配信性能 | CSS量、重複、キャッシュ、未使用CSSの削減 |
| チーム運用 | レビュー規則、IDE支援、デザイナーとの協業方法 |

「スタイリング戦略」は技術選定の中で軽視されがちだが、3年後の保守性に大きく影響する。**チーム全員が読めるか、新規メンバーが学べるか**を基準に選ぶ。

<a id="section-7-9"></a>
### 7.9 フォームのアクセシビリティ ― 名前、エラー通知、送信の結果
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"あ行","term":"アクセシブルな名前"} -->
<!-- handbook:index {"group":"ら行","term":"ライブリージョン"} -->
<!-- handbook:index {"group":"あ行","term":"エラーサマリ"} -->
<!-- handbook:index {"group":"A","term":"aria-describedby"} -->
<!-- handbook:index {"group":"A","term":"aria-live"} -->

<!-- handbook:narrative-bridge {"section":"7.9"} -->
7.8 のスタイリングは、入力欄の見た目を自由に作り替えられるようにした。ところが見た目を作り込むほど、要素が本来運んでいた情報 ― これは何の欄か、必須か、いま何が間違っているか ― が視覚表現だけに寄っていく。7.7 で扱ったフォーム状態は、画面に描くだけでなく、**支援技術へ届く形**にも変換しなければ利用者に届かない。6.11 で扱ったフォーカスは、その変換の主要な手段の1つである。

フォームは、Webアプリケーションでアクセシビリティの問題が最も濃く現れる場所である。理由は3つある。入力欄は必ず名前を必要とし、状態 (必須・エラー・無効) が視覚表現へ逃げやすく、そして送信の結果が非同期に返るためである。

本節では、6.9 で挙げた `label` と `aria-describedby` の型を出発点にして、**エラーが発生してから利用者がそれを修正できるまで**を通した設計を扱う。

#### アクセシブルな名前がどこから来るか

支援技術が「メールアドレス、編集テキスト、必須」と読み上げるときの「メールアドレス」の部分を、**アクセシブルな名前** (accessible name) と呼ぶ。名前は複数の供給元から計算され、優先順位がある。

| 優先 | 供給元 | 注意 |
|---:|---|---|
| 1 | `aria-labelledby`(参照先のテキスト) | 参照先が存在しないと名前が空になる。ID の綴り間違いは無言で失敗する |
| 2 | `aria-label`(属性値そのもの) | 画面に出ないため、翻訳・文言変更から取り残されやすい |
| 3 | `label` 要素 (`for` またはラップ) | デフォルトはこれ。画面上の表示とずれない |
| 4 | 要素固有の代替 (`img` の `alt`、`input[type=button]` の `value` など) | ― |
| 5 | `placeholder` | 入力を始めると消える。名前として頼らない |
| 6 | `title` 属性 | 読み上げ・表示ともに実装差が大きい |

実務上の原則は単純である。**画面に見えているラベルを、そのまま `label` 要素にする。** `aria-label` を使うと、画面の文言と読み上げの文言が別々に管理され、片方だけ更新される事故が起きる。また、音声入力で「メールアドレスをクリック」と指示する利用者は、画面に見えている文言を口にするため、名前と表示が食い違うと操作できない。

`placeholder` をラベル代わりにする設計は特によく見かけるが、次の問題を同時に起こす。入力を始めると何の欄だったか分からなくなる、デフォルトの文字色がコントラスト基準 (6.9) を満たさないことが多い、翻訳や自動入力の挙動が実装によって異なる。**プレースホルダは例示のためだけに使い、ラベルは必ず別に置く。**

関連する入力欄をひとまとめにして名前を付ける場合は `fieldset` と `legend` を使う。ラジオボタン群の「配送方法」のように、個々の選択肢の名前だけでは何を選んでいるのか分からない場合に必要になる。

```tsx
<fieldset>
  <legend>配送方法</legend>
  <label><input type="radio" name="shipping" value="standard" /> 通常配送（3〜5日）</label>
  <label><input type="radio" name="shipping" value="express" /> 翌日配送（追加 800円）</label>
</fieldset>
```

#### 必須と入力形式は「入力する前」に伝える

エラーを減らす最も効果的な方法は、間違える前に条件を伝えることである。

- **必須**: `required` 属性を付ける。ブラウザと支援技術の双方が状態を認識する。視覚的な `*` 印だけに頼らない。`*` を使う場合は、その意味をフォームの先頭で説明する。
- **形式**: 「8文字以上、英数字と記号を含む」のような条件は、入力欄の直後ではなく `aria-describedby` で結び付ける。そうすると、フォーカスが入った時点で条件が読み上げられる。
- **入力補助**: `autocomplete` 属性 (`email`、`tel`、`street-address`、`one-time-code` など) を正しく付ける。自動入力に頼る利用者の負担が大きく減る。運動機能や記憶に困難がある利用者にとっては、入力量そのものが障壁になる。

```tsx
<label htmlFor="password">パスワード</label>
<input
  id="password"
  type="password"
  required
  autoComplete="new-password"
  aria-describedby="password-rule password-error"
  aria-invalid={errors.password ? true : undefined}
/>
<p id="password-rule">12文字以上。英字・数字・記号のうち2種類以上を含める。</p>
{errors.password && <p id="password-error">{errors.password}</p>}
```

`aria-describedby` に複数の ID を空白区切りで並べられる点が重要である。条件の説明とエラーの両方を結び付けておけば、フォーカスを戻したときに「何が条件で、いま何が間違っているか」が続けて読み上げられる。エラーが無いときに `password-error` の要素が存在しなくても、参照が解決できないだけで害は無い。

`aria-invalid` は、エラーが**無い**ときに `aria-invalid="false"` を出すより、属性ごと外すほうが素直である。`false` を明示しても害は無いが、「検証がまだ走っていない」状態と「検証して問題なかった」状態を区別したい場合、属性の有無で表現できる。

#### エラーの通知には3つの経路が要る

送信を押してエラーが返ってきたとき、次の3つが揃っていないと、画面を見ていない利用者は先へ進めない。

| 経路 | 役割 | 実装 |
|---|---|---|
| フィールド単位 | 「この欄が何を間違えているか」 | `aria-invalid` + `aria-describedby` |
| まとめ | 「いくつ、どこが間違えているか」 | ページ上部のエラーサマリ。各項目から該当欄へのリンク |
| 通知 | 「いま何かが起きた」 | フォーカス移動、またはライブリージョン |

3つ目が最も忘れられる。フィールドにエラーテキストを描画しただけでは、フォーカスが送信ボタンにある利用者には何も起きていないように見える。**送信の結果は、必ず利用者へ届くように通知する。**

最も確実なのは、エラーサマリへフォーカスを移す方式である。ライブリージョンと違って、移動した先の内容が読み上げられることが構造的に保証され、しかも次の操作 (該当欄へのリンク) がその場にある。

```tsx
function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors);

  useEffect(() => {
    if (entries.length > 0) ref.current?.focus();
  }, [errors]);   // errors オブジェクトの同一性で「新しい送信の結果か」を判断する

  if (entries.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title">入力内容に{entries.length}件の問題があります</h2>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            {/* 該当欄へ移動できるようにする。ID は入力欄の id と一致させる */}
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

サマリの見出しに件数を含めるのは、読み上げの最初の一言で規模が分かるようにするためである。各項目をリンクにしておけば、キーボードだけで該当欄へ直接移動できる。

ライブリージョンを使う場合は、`aria-live` の性質を理解して置く。

- **領域は先に存在させておく。** 空の `<div aria-live="polite">` を最初から描画しておき、あとから中身のテキストだけを差し替える。要素ごと後から挿入すると、支援技術が監視を始める前に内容が入ってしまい、通知されないことがある。
- **`polite` をデフォルトにする。** `assertive`(および `role="alert"`) は、読み上げ中の内容に割り込む。フォームの検証結果程度で割り込むと、利用者が読んでいた説明が途切れる。割り込みが正当なのは、セッション切れのように操作が失われる場合である。
- **同じ文字列を再設定しても通知されない。** 「3件の問題があります」を2回続けて出しても、2回目は変化が無いため何も起きない。件数や時刻を含める、いったん空にしてから設定する、といった回避が要る。
- **`aria-atomic="true"` は領域全体を読み直させる。** 部分更新される数値 (残り文字数など) では冗長になる。デフォルトの `false` のままにしておくほうがよい場面が多い。

#### 検証を走らせる時機

入力の1文字ごとに検証してエラーを出し入れすると、ライブリージョンが連続で発火し、読み上げが実質的に使えなくなる。加えて、まだ入力途中の内容に対して「メールアドレスの形式が不正です」と表示するのは、視覚利用者にとっても不快である。

実務的な落としどころは次の形である。

- **初回はフォーカスが外れたとき (blur) か送信時に検証する。** 入力中は何も出さない。
- **いったんエラーになった欄は、入力中に再検証してよい。** 直っていることを即座に伝えられる。この場合もエラーが消えるだけならライブリージョンで通知しない。
- **送信時は必ず全体を検証する。** blur を経由しない入力経路 (自動入力、貼り付け、プログラムからの設定) があるため。

#### 送信中と送信後

送信ボタンを `disabled` にして二重送信を防ぐのは一般的だが、**`disabled` にした瞬間にその要素はフォーカスを失い、Tab 順序からも外れる**。押した直後にフォーカスが `body` へ落ち、利用者は現在地を失う。

代替は、ボタンをフォーカス可能なまま残し、状態だけを伝える形である。

```tsx
<button
  type="submit"
  aria-disabled={isSubmitting || undefined}
  onClick={(event) => {
    if (isSubmitting) event.preventDefault();   // 実際の抑止は自分で行う
  }}
>
  {isSubmitting ? '送信中…' : '送信'}
</button>
```

`aria-disabled` は「操作できない」ことを伝えるが、ブラウザの動作は変えない。したがって送信の抑止はコードで行う必要がある。見た目も、`:disabled` 疑似クラスではなく `[aria-disabled="true"]` に対して当てる。なお、二重送信をサーバ側で防ぐ仕組み (冪等キー、26.10) は、この対策とは別に必ず要る。クライアント側の抑止は体験の改善であって保証ではない。

送信が完了したことも通知する。画面遷移を伴わない送信では、成功メッセージをライブリージョンへ出すか、結果の見出しへフォーカスを移す。「送信して何も起きなかったように見える」は、視覚に頼らない利用者にとって最も困る状態である。

サーバから返るエラーも、クライアント側の検証結果と同じ経路に載せる。12.5 の `Problem Details` のように、フィールド名とメッセージを構造化して返しておけば、サマリとフィールド単位の表示をそのまま再利用できる。返ってきたフィールド名が画面上に存在しない場合 (サーバだけが知る制約) には、サマリにだけ出してリンクを付けない、という扱いを決めておく。

#### つまずく箇所 ― フォームのアクセシビリティ

- **`placeholder` をラベル代わりにする**: 入力を始めた瞬間に何の欄か分からなくなる。ラベルは別に置く。
- **`aria-label` で画面と別の文言を持つ**: 文言変更や翻訳で片方だけ古くなる。音声入力の利用者は画面の文言を読み上げるため操作できなくなる。
- **エラーを描画するだけで通知しない**: 送信ボタンにフォーカスがある利用者には何も起きていないように見える。フォーカス移動かライブリージョンで伝える。
- **ライブリージョンの要素をエラー発生時に挿入する**: 監視開始前に内容が入り、通知されないことがある。空の領域を先に置く。
- **すべての通知を `assertive` にする**: 読み上げ中の内容へ割り込み続け、利用者は文脈を失う。割り込みは操作が失われる場合に限る。
- **入力の1文字ごとに検証する**: ライブリージョンが連続で発火し、読み上げが成立しない。初回は blur か送信時に行う。
- **送信中にボタンを `disabled` にする**: フォーカスが `body` へ落ちる。`aria-disabled` と自前の抑止に置き換える。
- **`aria-describedby` の参照先 ID を綴り間違える**: 何のエラーも出ず、説明が単に届かなくなる。自動検査で拾える種類の不具合である (25.11)。

<a id="section-7-10"></a>
### 7.10 実装課題 ― 状態管理の核を作る
<!-- handbook:learning {"level":"practical","minutes":220} -->

<!-- handbook:narrative-bridge {"section":"7.10"} -->
状態管理ライブラリのAPIを使うだけでは、購読、キャッシュ、楽観的更新の責務分担を理解しにくい。最小実装で、更新通知とサーバ同期がどの境界をまたぐかを確認する。

第7章では Redux から TanStack Query まで、状態管理の系譜を見た。本節ではそれぞれの核となる仕組みを自作する。所要時間: 演習カードの推定時間の合計で7時間。

#### 課題7.1: Redux を自作する (★★)

**目的**: Redux の核は実は数十行で書ける。これを自作することで、Reducer・Action・Store の役割を完全に理解する。

<!-- handbook:exercise:start {"id":"7.1"} -->
> **演習カード 課題7.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 7.2 Flux と Redux ― 単方向データフローの徹底 を読み、action、reducer、store の役割分担を説明できる状態にする
> - 7.1 状態の3分類 を読み、共有状態としてストアに置くべきものの範囲を把握しておく
> - `pnpm --filter @handbook/ch07 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch07/redux.ts` に `createStore(reducer, initialState)` を実装し、`getState` / `dispatch` / `subscribe` を持つオブジェクトを返す
> - [ ] `dispatch` が reducer の戻り値で状態を置き換え、その後で登録済みリスナーを全件呼ぶ
> - [ ] `subscribe` が解除関数を返し、解除後の dispatch ではそのリスナーが呼ばれない
> - [ ] reducer の実行中に dispatch されたら例外を投げ、再入を防いでいる
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch07 run test` が全件パスする
>
> **期待出力**
>
> - テスト `Redux store notifies subscribers and unsubscribe works` が pass する
> - `inc`、`set(10)`、解除、`inc` の順に dispatch したとき、リスナーが記録した配列が `[1, 10]` になり、最終 `getState()` が 11 になる
> - reducer 内から dispatch すると `Reducers may not dispatch actions` のようなエラーが throw される
> - 同じリスナーの解除関数を2回呼んでも例外にならず、2回目は何もしない
>
> **観察項目**
>
> - リスナー集合を反復中にコピーせず直接回す実装に変え、リスナー内で subscribe や解除を行ったときに反復が壊れることを確認する
> - reducer が state を破壊的に変更する版へ書き換え、`getState()` の参照が変わらないために変更検知ができなくなることを確認する
> - dispatch を1000回連続で呼び、リスナー数に比例して通知コストが増えることを計測する
> - `replaceReducer` で reducer を差し替え、既存の state を保ったまま挙動だけ変わることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch07 run test` を実行し、Redux ストアのテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`Store<State, A>` のジェネリクスでエラー0件なら合格
> 3. reducer の中から `store.dispatch` を呼ぶコードを一時的に書き、例外が投げられることを確認してから削除する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: createStore の中身はクロージャ変数3つ (現在の state、現在の reducer、リスナー集合) だけで足りる。まず getState と dispatch を通し、subscribe は後から足す
> 2. **構造**: リスナーは `Set<() => void>` で保持し、subscribe は `active` フラグ付きの解除関数を返す。dispatch では `[...listeners]` のコピーを回してから通知する
> 3. **実装の要点**: 再入防止は `dispatching` フラグ1つで実現する。フラグの解除を `finally` に置かないと、reducer が例外を投げたあとストアが二度と dispatch を受け付けなくなる
>
> **本番利用時の警告**
>
> - この実装は Redux DevTools 連携、ミドルウェア、非同期アクションを持たない。ログや API 呼び出しを reducer へ書き足すと純粋性が壊れ、状態の再現ができなくなる
> - state を破壊的に変更しても検知できないため、reducer が誤って引数を書き換えると UI が更新されないバグになる。本番では immer などの不変性の保証を伴う仕組みを使う
>
> **導線**
>
> - 開始地点: `code/ch07/redux.ts`
> - 模範解答: `code/ch07/redux.solution.ts`
>
> **推定時間の内訳**: createStore の骨格実装に25分、subscribe と解除関数、再入防止に35分、テスト実行と破壊的更新の観察に30分
<!-- handbook:exercise:end -->

**要件**: `createStore(reducer, initialState)` を実装。

```typescript
type Action = { type: string; payload?: any };
type Reducer<S> = (state: S, action: Action) => S;

interface Store<S> {
  getState(): S;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
}

function createStore<S>(reducer: Reducer<S>, initial: S): Store<S> { /* TODO */ }

// 使用例
const counter = createStore((state, action) => {
  switch (action.type) {
    case 'inc': return state + 1;
    case 'dec': return state - 1;
    case 'set': return action.payload;
    default: return state;
  }
}, 0);

const unsubscribe = counter.subscribe(() => console.log(counter.getState()));
counter.dispatch({ type: 'inc' });  // → 1
counter.dispatch({ type: 'inc' });  // → 2
counter.dispatch({ type: 'set', payload: 100 });  // → 100
unsubscribe();
```

**発展**: Middleware パターン (`applyMiddleware`) を実装。Logger と Thunk(関数を dispatch できるようにする) を作る。

模範解答: `code/ch07/redux.solution.ts`

#### 課題7.2: TanStack Query 風キャッシュ (★★★)

**目的**: サーバ状態管理の中核「**重複リクエスト排除、キャッシュ、再検証、エラー処理**」を自作する。

<!-- handbook:exercise:start {"id":"7.2"} -->
> **演習カード 課題7.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 7.4 サーバ状態の特殊性 を読み、staleTime と gcTime が別の概念であることを説明できる状態にする
> - 7.5 TanStack Query (React Query) ― サーバ状態管理の代表例 を読み、queryKey と無効化の考え方を把握しておく
> - 5.4 非同期処理の進化 を読み、複数の await が同じ Promise を共有する挙動を理解しておく
> - `pnpm --filter @handbook/ch07 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch07/query-cache.ts` に `QueryCache` クラスを実装し、`fetch(key, fetcher, options)` が同じ queryKey の in-flight Promise を共有する
> - [ ] queryKey のシリアライズがキーの順序に依存せず、`['user', 1]` のような配列とネストしたオブジェクトを安定して同じ文字列へ落とす
> - [ ] `staleTime` 内の再取得ではフェッチャを呼ばずキャッシュ値を返す
> - [ ] `invalidate(prefix)` がプレフィクス一致するエントリを stale にし、次の fetch で再取得が走る
> - [ ] `collectGarbage()` が `gcTime` を超えて未使用のエントリだけを削除し、削除件数を返す
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch07 run test` が全件パスする
>
> **期待出力**
>
> - テスト `QueryCache deduplicates in-flight requests and respects staleTime` が pass する
> - 同じキーで3本同時に fetch しても、フェッチャの呼び出し回数が 1 のままで、3つの戻り値が等しくなる
> - staleTime 100 の設定で時刻を 50 へ進めても呼び出し回数が 1 のままで、`invalidate` 後の fetch で 2 に増える
> - `inspect(key)` が `updatedAt`、`lastUsedAt`、`stale`、`inFlight` を含むエントリを返す
>
> **観察項目**
>
> - 現在時刻を注入可能にした `now()` を差し替え、実時間を待たずに staleTime と gcTime の境界を跨いだときの挙動を観察する
> - in-flight の共有を外して毎回新しい Promise を作る版に変え、同時3リクエストでフェッチャ呼び出しが3回に増えることを確認する
> - フェッチャが reject したときに `inFlight` が確実に undefined へ戻るかを `inspect` で確認し、次回 fetch がリトライされることを見る
> - キーを `['user', { id: 1, sort: 'asc' }]` と `['user', { sort: 'asc', id: 1 }]` の2通りで渡し、シリアライズ結果が一致することを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch07 run test` を実行し、QueryCache のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`fetch<T>` の戻り値型でエラー0件なら合格
> 3. 時刻関数を進めてから `collectGarbage()` を呼び、gcTime を超えたエントリ数と同じ値が返れば GC の判定が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: キャッシュの1エントリに何を持たせるかを先に決める。データ、最終更新時刻、最終利用時刻、stale フラグ、進行中の Promise の5つが揃えば、残りは分岐を書くだけになる
> 2. **構造**: `Map<string, Entry>` と、キーを安定文字列へ落とす `stableSerialize` を用意する。fetch は「進行中があれば返す」「新鮮なら返す」「それ以外は取得する」の3分岐にする
> 3. **実装の要点**: in-flight の Promise は成功時も失敗時も必ず `entry.inFlight = undefined` へ戻す。then の第2引数 (またはエラー経路) でこれを忘れると、1度失敗したキーが永久に再取得できなくなる
>
> **本番利用時の警告**
>
> - このキャッシュは購読者数に基づく参照カウントを持たず、`collectGarbage` を呼ぶまでメモリを保持し続ける。長時間稼働する画面にそのまま載せるとヒープが増え続ける
> - レスポンスをキー単位でそのまま保持するため、ユーザー固有データを共通キーでキャッシュするとログアウト後や別ユーザーへ内容が漏れる。本番ではキーに認証主体を含め、ログアウト時に全消去する
>
> **導線**
>
> - 開始地点: `code/ch07/query-cache.ts`
> - 模範解答: `code/ch07/query-cache.solution.ts`
>
> **推定時間の内訳**: エントリ構造とキーシリアライズの設計に35分、dedupe と staleTime 判定に45分、invalidate と GC の実装に40分、時刻注入による境界検証に30分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const cache = new QueryCache();

// useQuery 相当(Promise ベース)
async function fetchUser(id: number) {
  return cache.fetch(
    ['user', id],                       // queryKey
    () => fetch(`/api/users/${id}`).then(r => r.json()),  // fetcher
    {
      staleTime: 30_000,                 // 30秒は新鮮
      gcTime: 5 * 60_000,                // 5分以上未使用ならGC
    }
  );
}

// 同時に何度呼んでも、ネットワーク request は1回(in-flight deduping)
const [a, b, c] = await Promise.all([
  fetchUser(1),
  fetchUser(1),  // dedupe される
  fetchUser(1),
]);

// staleTime 内なら ネットワークなしで即返す
const cached = await fetchUser(1);  // ネットワーク無し

// invalidate で強制再取得
cache.invalidate(['user', 1]);
await fetchUser(1);  // 再取得
```

**機能要件**:
- ✓ 重複排除 (同じ queryKey の inflight Promise を共有)
- ✓ staleTime: この時間内はキャッシュを使う
- ✓ gcTime: この時間以上 unsubscribe されたら破棄
- ✓ invalidate: キーまたはプレフィクスでキャッシュ無効化
- ✓ subscribe: キャッシュ更新を購読

模範解答: `code/ch07/query-cache.solution.ts`

#### 課題7.3: 楽観的更新の実装 (★★)

**目的**: 「**サーバの応答を待たずに UI を更新し、失敗時にロールバック**」のパターンを実装する。

<!-- handbook:exercise:start {"id":"7.3"} -->
> **演習カード 課題7.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 7.6 楽観的更新 (Optimistic Update) を読み、確定状態と未確定操作を分けて持つ理由を説明できる状態にする
> - 7.4 サーバ状態の特殊性 を読み、サーバが正本であることとロールバックの位置づけを確認しておく
> - `pnpm --filter @handbook/ch07 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch07/optimistic/starter/optimistic-update.ts` に `OptimisticStore` を実装し、確定状態と未確定操作列を別々に保持する
> - [ ] `mutate(update, send)` が送信完了を待たずに `getState()` の値を更新する
> - [ ] 送信が失敗したとき、その操作だけを未確定列から除いて再計算し、成功済みの他操作の結果を巻き戻さない
> - [ ] `mutate` の戻り値が成功時 `{ ok: true }`、失敗時 `{ ok: false, error }` になる
> - [ ] `onError` で登録したリスナーが失敗時に呼ばれ、トーストなどの通知に使える
> - [ ] 30% の確率で失敗するモックを使い、連続操作後も確定状態と表示が矛盾しない
>
> **期待出力**
>
> - テスト `OptimisticStore rolls back only failed operation` が pass する
> - +1 と +10 の2操作を同時に走らせた直後、`getState().count` が 11 になる
> - +10 が成功し +1 が失敗したあと、`getState().count` が 10 に落ち着く
> - 失敗した `mutate` の戻り値が `{ ok: false }` で、`error.message` にサーバ拒否の理由が入る
>
> **観察項目**
>
> - `getPendingCount()` を操作の前後でログし、送信中は増え、成功でも失敗でも減ることを確認する
> - 確定状態ではなく表示用の状態を直接書き換える実装へ変え、失敗が2件重なったときに値がずれることを再現する
> - 失敗と成功が入れ替わる順序 (先に出した操作が後で失敗する) を作り、後続操作の結果が保たれることを確認する
> - `subscribe` の通知回数を数え、1回の mutate で楽観適用と確定反映の2回通知が飛ぶことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch07 run test` を実行し、OptimisticStore のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`Updater<T>` と `MutationResult` の型でエラー0件なら合格
> 3. `flakyServer(1)` のように必ず失敗するモックで mutate を呼び、`getState()` が呼び出し前の値へ完全に戻れば合格
> 4. `flakyServer(0.3)` で20回連続操作し、`onError` の発火回数と最終状態の差分が一致すれば整合性が保たれている
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 巻き戻しを「逆操作」で実装しない。確定状態を1つ持ち、未確定の更新関数を配列で持って、毎回先頭から畳み込んで表示用の状態を作る方式にすると失敗時の処理が削除だけで済む
> 2. **構造**: 各操作に連番 id を振り、`pending: { id, update }[]` として保持する。成功時は確定状態へ update を適用してから配列から除去、失敗時は適用せず除去し、どちらの場合も `recompute()` で表示状態を作り直す
> 3. **実装の要点**: 失敗した操作を配列から除く前に確定状態を書き換えないこと。順序を誤ると、後から成功した操作の結果が失敗操作の巻き戻しに巻き込まれて消える
>
> **本番利用時の警告**
>
> - 楽観的更新はユーザーに「成功した」という誤った印象を与える。決済、在庫引き当て、権限変更のように取り消しが利かない操作へ適用すると、ロールバックしても業務上の不整合が残る
> - この実装はリトライ、順序保証、オフライン時のキュー永続化を持たない。タブを閉じると未確定操作は消えるため、本番では冪等キー付きの再送とサーバ側の整合性チェックが必要になる
>
> **導線**
>
> - 開始地点: `code/ch07/optimistic/starter/README.md`、`code/ch07/optimistic/starter/optimistic-update.ts`
> - 模範解答: `code/ch07/optimistic/solution/README.md`、`code/ch07/optimistic/solution/optimistic-update.ts`
>
> **推定時間の内訳**: 確定状態と未確定列の分離設計に25分、mutate と recompute の実装に35分、失敗モックでの連続操作検証と通知に30分
<!-- handbook:exercise:end -->

**要件**: 簡単な Todo リストで:
- 追加: 即座にリストに表示、サーバ応答失敗で削除
- 完了切替: 即座にチェック、失敗で元に戻す
- 削除: 即座にリストから消す、失敗で復元

人工的にエラーを 30% 発生させる API モックを使い、エラー時のロールバック動作を視覚的に確認できるようにする。

**評価基準**:
- UI に「即時反映」が見える
- 30% 失敗で正しくロールバックされる
- 連続して操作してもデータ整合性が保たれる
- エラー時にトースト通知 or 何らかのフィードバック

模範解答: `code/ch07/optimistic/`

#### 課題7.4: フォームの reactive validation (★★)

**目的**: Zod ベースのフォーム検証を実装する。React Hook Form の核を理解する。

<!-- handbook:exercise:start {"id":"7.4"} -->
> **演習カード 課題7.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 7.7 リアクティブな状態とフォーム を読み、入力中の値と送信済み状態を分ける理由を把握しておく
> - zod のスキーマ定義と `safeParse` の戻り値 (`success` と `error.issues`) を読める
> - `code/ch07/form-validation.ts` の TODO コメントに目を通し、実装すべきメソッドを把握する
> - `pnpm --filter @handbook/ch07 run typecheck` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch07/form-validation.ts` の `FormController` に `setValue` / `touchField` / `submit` / `reset` / `validateField` / `validateAll` を実装する
> - [ ] `touchField`(blur 相当) を呼んだフィールドだけにエラーが表示され、未 touch のフィールドにはエラーが出ない
> - [ ] `submit` が全フィールドを touched にしてから全体検証し、`isValid` が false のときは `onSubmit` を呼ばない
> - [ ] `submit` 中は `isSubmitting` が true になり、`onSubmit` の完了後 (例外時も含め) に false へ戻る
> - [ ] `subscribe` したリスナーが値の変更・touch・送信状態の変化ごとに呼ばれる
> - [ ] `reset()` で values が initialValues に戻り、errors と touched が空になる
>
> **期待出力**
>
> - `email` に `invalid` を入れて touch すると `errors.email` に `有効なメールアドレスを入力` が入る
> - `password` を `ValidPass8`、`age` を 25、`email` を正しい形式にすると `getState().isValid` が true になる
> - `age` に 17 を入れて touch すると `18歳以上` のメッセージが `errors.age` へ入る
> - 全項目が妥当な状態で `submit()` すると `onSubmit` が1回だけ呼ばれ、渡される値が `z.infer` された型として補完される
>
> **観察項目**
>
> - `safeParse` の `error.issues` を丸ごと出力し、`path[0]` でフィールドを特定する仕組みと、同一フィールドに複数 issue が並ぶ場合の先頭採用を確認する
> - 未 touch のフィールドにもエラーを出す実装へ一時的に変え、入力開始直後から赤字が並ぶ体験の悪さを確認する
> - `isValid` の計算だけ全体検証で行い、表示エラーは touched のみに限定する二重構造になっていることを `getState()` で確認する
> - `onSubmit` が例外を投げるケースを作り、`isSubmitting` が finally で false に戻ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch07 exec tsx form-validation.solution.ts` を実行し、模範解答が Test 1 から Test 3 までの状態遷移ログを出すことを先に確認する
> 2. `pnpm --filter @handbook/ch07 run typecheck` を実行し、`FormController<FormData>` の型推論でエラー0件なら合格
> 3. 自作実装へ同じ操作列 (不正な email を入れて touch、修正、password と age を入力、submit) を流し、模範解答と同じ errors と isValid の推移になれば合格
> 4. この課題は `code/ch07/solutions.test.ts` の対象外なので、typecheck と実行ログの一致で判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 検証の単位を先に決める。zod はオブジェクト全体を1回で検証するので、フィールド単位のエラーは「全体検証の結果から該当 path の issue を抜き出す」形にすると実装が1本化できる
> 2. **構造**: 内部状態は `values`、`errors`、`touched: Set<keyof T>`、`isSubmitting`、`isValid` の5つ。`validateField` は `schema.safeParse(values)` の `issues` から `issue.path[0] === field` の先頭を取り、無ければ該当エラーを delete する
> 3. **実装の要点**: `isValid` は touched に関係なく常に全体検証の結果で更新する。表示するエラーだけを touched で絞る。ここを一緒くたにすると、未入力のまま送信ボタンが活性化する不具合になる
>
> **本番利用時の警告**
>
> - クライアント側の検証は UX のためのものでセキュリティ境界ではない。同じスキーマをサーバ側でも実行しないと、DevTools から直接 API を叩かれた時点で不正な値が保存される
> - `errors` にサーバ由来のメッセージをそのまま流し込む実装へ拡張すると、DB エラー文などの内部情報が画面に露出する。表示するメッセージは必ず自前の辞書へマップする
>
> **導線**
>
> - 開始地点: `code/ch07/form-validation.ts`
> - 模範解答: `code/ch07/form-validation.solution.ts`
>
> **推定時間の内訳**: 状態設計と setValue/touchField の実装に30分、submit と reset、購読通知に35分、模範解答との挙動突き合わせに25分
<!-- handbook:exercise:end -->

**要件**:

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Uppercase required'),
  age: z.number().int().min(18),
});

// 自作のフォームヘルパ
const form = useForm({
  schema,
  initialValues: { email: '', password: '', age: 0 },
  onSubmit: async (data) => {
    // data は完全に型推論される
    await api.register(data);
  },
});

// JSX 内
<input {...form.register('email')} />
{form.errors.email && <p>{form.errors.email}</p>}
```

要件:
- ✓ 各フィールドの値と error 状態を管理
- ✓ blur 時に該当フィールドだけ検証
- ✓ submit 時に全フィールド検証
- ✓ Zod のスキーマで型推論

開始ファイル: `code/ch07/form-validation.ts`

模範解答: `code/ch07/form-validation.solution.ts`

この課題ではフレームワーク非依存のフォーム制御ロジックを実装する。Reactとの統合は発展課題とし、`useSyncExternalStore` 等を使ってUIへ接続する。

---

<!-- handbook:code-usage:start {"chapter":7} -->
### 第7章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第7章の模範解答をまとめて検証する
pnpm --filter @handbook/ch07 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch07 exec tsx redux.solution.ts                         # 課題7.1
pnpm --filter @handbook/ch07 exec tsx query-cache.solution.ts                   # 課題7.2
pnpm --filter @handbook/ch07 exec tsx optimistic/solution/optimistic-update.ts  # 課題7.3
pnpm --filter @handbook/ch07 exec tsx form-validation.solution.ts               # 課題7.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch07/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-8"></a>
## 第8章 ビルドツールとモジュールバンドラ

第7章までで、UIと状態を責務ごとに分割できるようになった。ところが、設計を細かいモジュールへ分けるほど、ブラウザが読み込むファイル数、TypeScriptやJSXなど変換が必要な構文、環境ごとの差分も増える。ソースコードとして保守しやすい構成と、ネットワーク越しに配布しやすい構成は同じではない。

本章では、その隔たりを埋めるビルド工程を扱う。バンドラは単にファイルを一つへ結合する道具ではなく、依存グラフを解析し、不要コードを除き、開発時と本番時で異なる最適化を行う。Webpack、esbuild、Vite、HMR (Hot Module Replacement) をこの役割の違いから理解し、第9章では、完成したコードを「どの場所・どの時点で実行してHTMLを作るか」という配信戦略へ進む。

なぜビルドツールが必要なのか? 規模のあるWebアプリは数百から数千のモジュール、TypeScript、CSS、画像、フォントなど多種のリソースを抱える。これを直接ブラウザに読ませると:

- HTTPリクエストが大量発生 (HTTP/2でも限界がある)
- ブラウザはTypeScriptもJSXも理解しない
- node_modulesの巨大さ (数十万ファイル)
- 開発時に毎回フルビルドだと遅い

ビルドツールはこれらを解決する。

<!-- handbook:chapter-guide:start {"chapter":8} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> ビルドが遅い、依存が重い、本番だけ壊れる、不要コードが残る問題を、モジュールグラフと変換工程から診断する。
>
> **到達目標**
> - 依存解析、変換、チャンク分割、最適化の流れを説明できる。
> - ESMとCommonJS、開発サーバと本番ビルドの差を説明できる。
> - 計測に基づいてツールと最適化を選べる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [4.6 モジュールシステムの進化](02-part1-foundations.md#section-4-6) ― モジュールシステム
> - [5.7 TypeScript ― 型システムの設計思想](#section-5-7) ― TypeScript
>
> **中核概念**  
> [8.1 バンドラの基本原理](#section-8-1)、[8.4 Vite ― 開発体験の革新](#section-8-4)、[8.5 ツリーシェイキング](#section-8-5)、[8.6 コード分割 (Code Splitting)](#section-8-6)、[8.7 HMR (Hot Module Replacement)](#section-8-7) (実務選択)
>
> **最小実装**  
> [8.9 実装課題 ― ビルドツールの内側](#section-8-9) (実務選択)
>
> **本番実装との差分**
> - 自作バンドラは完全な構文解析、source map、CSS/asset処理、循環依存、プラグイン安全性を省略している。
>
> **典型的な失敗**
> - 開発時の速さだけで本番出力を評価する。
> - sideEffects設定を誤り必要コードを消す。
> - バンドルサイズを転送量だけで評価する。
>
> **診断・デバッグ方法**
> - ビルドメタファイルとbundle analyzerで依存元を確認する。
> - キャッシュを無効化して再現性を確認する。
>
> **意思決定チェックリスト**
> - アプリかライブラリか。
> - ブラウザ対象とNode対象を分ける必要があるか。
> - 最適化の効果を何で測るか。
>
> **演習と評価基準**  
> 対象: [8.9 実装課題 ― ビルドツールの内側](#section-8-9) (実務選択)
> - 依存グラフから出力チャンクを説明できる。
> - 改善前後のサイズと実行時間を同じ条件で比較できる。
>
> **一次資料・発展資料**
> - ECMAScript Modules
> - Vite documentation
> - Rollup documentation
> - WebAssembly specifications
<!-- handbook:chapter-guide:end -->

<a id="section-8-1"></a>
### 8.1 バンドラの基本原理
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"8.1"} -->
モジュール分割されたコードを配布するには、まずimport関係を依存グラフとして解釈する必要がある。バンドラの各最適化は、このグラフを正しく構築できることを前提にしている。

バンドラ (webpack、Rollup、esbuild) の仕事を分解する:

1. **エントリポイントから依存を辿る**: `import` 文を解析
2. **モジュールグラフを構築**: 依存関係の有向グラフ
3. **トランスフォーム**: TypeScript → JavaScript、JSX → JavaScript、各種ローダ
4. **ツリーシェイキング**: 使われていない export を削除
5. **コード分割**: 動的 import で複数チャンクに分割
6. **最適化**: ミニファイ、デッドコード除去、リネーミング
7. **出力**: 1つまたは複数のバンドルファイル

<a id="section-8-2"></a>
### 8.2 Webpack ― 成熟した汎用バンドラ
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"8.2"} -->
依存グラフを扱えると、JavaScript以外の資産や環境別変換も同じパイプラインへ組み込みたくなる。Webpackはloaderとpluginによって、この汎用性を追求した設計である。

Webpack はその柔軟性で長く支配的だった。すべてが「ローダ」と「プラグイン」で構成され、画像も CSS もフォントも JavaScript に取り込める。

```javascript
// webpack.config.js (例)
module.exports = {
  entry: './src/index.ts',
  output: { path: __dirname + '/dist', filename: 'bundle.[contenthash].js' },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(png|jpg)$/, type: 'asset/resource' },
    ],
  },
  optimization: {
    splitChunks: { chunks: 'all' },  // コード分割
  },
};
```

Webpackは柔軟な一方、構成とプロジェクト規模によって次の課題が生じることがある:

- **JavaScript実装**: 設定の柔軟性と引き換えに、ビルドが遅い
- **設定の複雑さ**: ローダ・プラグインの順序、コンフィグの肥大化
- **開発体験**: HMR (Hot Module Replacement) があっても大規模プロジェクトでは遅い

<a id="section-8-3"></a>
### 8.3 esbuild と SWC ― ネイティブ実装の衝撃
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"E","term":"esbuild"} -->

<!-- handbook:narrative-bridge {"section":"8.3"} -->
汎用性が高いほど、変換量と設定量が増えてビルド時間が問題になる。esbuildとSWCは、処理系の実装言語と並列化を見直し、変換そのものの速度を引き上げる。

2020年頃から、JavaScriptをコンパイラ言語で実装する潮流が来た。

- **esbuild**: Goで実装されたコンパイラ・バンドラ。並列処理と一体設計により高いスループットを目指す
- **SWC**: Rustで実装されたJavaScript/TypeScriptコンパイラ基盤
- **Rolldown**: RustとOxcを利用するバンドラで、Vite 8の統一バンドラとして採用された
- **Turbopack**: Rustで実装されたNext.js向けのインクリメンタルなバンドラ

これらはTypeScript/JSX変換、バンドル、ミニファイなどの処理時間を短縮し得る。速度倍率は入力、プラグイン、キャッシュ、変換内容、マシンで大きく変わるため、異なる機能セットの公称値だけで比較せず、対象リポジトリで測定する。

<a id="section-8-4"></a>
### 8.4 Vite ― 開発体験の革新
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"V","term":"Vite"} -->

<!-- handbook:narrative-bridge {"section":"8.4"} -->
本番ビルドが高速でも、開発中に全体を毎回まとめ直すと待ち時間が残る。Viteは開発時にはブラウザのES Modulesを利用し、必要なモジュールだけを変換することで起動と更新を分離する。

Vite (Evan Youが開始したフレームワーク非依存のビルドツール) は、開発サーバと本番ビルドを統合したツールチェーンである。2026年7月時点のVite 8は、開発時の依存関係事前バンドルと本番ビルドの双方にRolldownを使い、変換基盤としてOxc等を統合している [Vite 8, 2026]。

**開発時の基本モデル:**

- ソースモジュールをリクエストに応じて変換し、ブラウザへESMとして配信する
- bare importをブラウザが読めるURLへ解決する
- CommonJS/UMD互換と多数の内部モジュールによるリクエスト増加を抑えるため、依存関係をRolldownで事前バンドルする
- キャッシュとオンデマンド変換で変更時の処理範囲を抑える

ブラウザは`import`に従ってモジュールを要求し、Viteは必要な変換と解決を行って返す。これにより、従来型の「起動前にアプリ全体を必ずバンドルする」方式と比べて、初期処理や変更時の対象を減らせる場合がある。ただし大規模な依存グラフ、プラグイン、型検査、ネットワーク要求数によって性能は変わる。

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom'] },
      },
    },
  },
});
```

Vite 7 以前は、開発時に esbuild、本番ビルドに Rollup を使うハイブリッド構成だった。この分割は、開発時と本番でビルド結果が食い違う原因にもなっていた。

<a id="section-8-5"></a>
### 8.5 ツリーシェイキング
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"8.5"} -->
変換が速くても、利用しないコードまで配布すれば初期ロードは重くなる。ツリーシェイキングは静的なexport/import関係を使い、到達しないコードを依存グラフから除く。

「使われていない export を削除する」最適化。これが効くのは ESM の場合のみ (CJS は実行時に動的に require できるため、静的解析できない)。

```typescript
// utils.ts
export function used() { return 'used'; }
export function unused() { return 'unused'; }
export function alsoUnused() { return 'alsoUnused'; }

// app.ts
import { used } from './utils';
console.log(used());

// ビルド後のバンドルには used() だけが含まれる (unused、alsoUnused は削除)
```

しかし、副作用のある import はツリーシェイクできない。

```typescript
import './polyfill';  // 副作用のためだけに import (削除されない)
```

package.json の `"sideEffects"` は、バンドラへ「このパッケージのモジュールは、import しても副作用を持たない」と伝える宣言である。宣言があると、使われていない import をバンドラが丸ごと落とせるようになる。

これは**約束であって、検査ではない**。バンドラは中身を確かめず、書かれたとおりに信じる。実際には副作用があるのに `false` と書くと、polyfill、CSSの読み込み、グローバルへの登録、`customElements.define` の呼び出しなどが黙って消え、本番でだけ動かなくなる。原因が分かりにくい部類の事故である。

安全なのは、副作用のあるファイルを列挙する形である。

```json
{
  "sideEffects": ["./src/polyfill.ts", "*.css"]
}
```

`false` を書くのは、パッケージ内のすべてのモジュールに副作用が無いと確認できたときだけにする。

<a id="section-8-6"></a>
### 8.6 コード分割 (Code Splitting)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"か行","term":"コード分割"} -->

<!-- handbook:narrative-bridge {"section":"8.6"} -->
不要コードを除いても、利用する全機能を初回に読み込む必要はない。コード分割は経路や操作の境界でグラフを分け、必要になる時点まで取得を遅らせる。

すべてのコードを1ファイルにまとめると、初期ロードが遅くなる。動的 import でチャンクを分ける。

```typescript
// 静的 import: 起動時に必ず読み込まれる
import { LineChart } from './LineChart';

// 動的 import: 必要なときだけ読み込み
const Chart = lazy(() => import('./LineChart'));
```

Reactでは `lazy` と `Suspense` でルートごとに分割するのが定番。

```tsx
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const Dashboard = lazy(() => import('./Dashboard'));
const Settings  = lazy(() => import('./Settings'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

<a id="section-8-7"></a>
### 8.7 HMR (Hot Module Replacement)
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"H","term":"HMR (Hot Module Replacement)"} -->
<!-- handbook:index {"group":"は行","term":"ホットリロード"} -->

<!-- handbook:narrative-bridge {"section":"8.7"} -->
コード分割で配布単位を小さくすると、開発中の変更も該当モジュールだけ差し替えられる。HMRはアプリ状態を可能な限り保ったまま、変更部分を実行中のモジュールグラフへ反映する。

開発時、ファイルを保存するたびにページがリロードされるとフォーム入力が消えたり、状態が失われたりする。HMR はモジュール単位で**ページを再読み込みせず**にコードを差し替える。

Vite では React Fast Refresh と組み合わせて、コンポーネントの状態を保ったままコード変更が反映される。

仕組み:

1. 開発サーバがファイル変更を検知
2. WebSocket でブラウザに通知
3. ブラウザは変更されたモジュールだけを再 fetch
4. モジュールの `import.meta.hot.accept` が呼ばれ、受け入れる

```typescript
// Vite の HMR API
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // 新しいモジュールが届いたときの処理
  });
}
```

通常はフレームワークのプラグイン (`@vitejs/plugin-react` など) が抽象化してくれるので、開発者が直接書くことは少ない。

<a id="section-8-8"></a>
### 8.8 WebAssembly (Wasm) ― ブラウザに「JavaScript以外」を持ち込む
<!-- handbook:learning {"level":"advanced","minutes":20} -->
<!-- handbook:index {"group":"W","term":"WebAssembly (Wasm)"} -->

<!-- handbook:narrative-bridge {"section":"8.8"} -->
JavaScriptの変換・分割を最適化しても、計算特性によっては別言語の実装を使いたい。WebAssemblyはブラウザの安全モデルを維持したまま、JavaScript以外のコンパイル成果物をモジュールグラフへ組み込む。

JavaScript は便利だが、画像処理・暗号・物理シミュレーション・データ圧縮など、CPU負荷の高い処理では遅すぎる。**WebAssembly** は C/C++/Rust などのコンパイル結果をブラウザで動かす仕組みで、ネイティブに近い速度を実現する。

#### 何ができるか

- **既存のC/C++ライブラリをブラウザへ移植**: SQLite、FFmpeg、ImageMagick、PDF.js
- **計算集約的な処理を高速化**: 画像フィルタ、3D レンダリング、暗号化
- **ブラウザ外でも動かす**: WASI で Node.js・Cloudflare Workers・組み込みでも実行
- **言語の選択肢**: Rust、Go、C++、AssemblyScript、Zig

JavaScript の代替ではなく**補完**だ。UI ロジックは JavaScript、ヘビーな計算は Wasm。

#### Rust → Wasm の例

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn fibonacci(n: u32) -> u64 {
    if n < 2 { return n as u64; }
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 2..=n {
        let c = a + b;
        a = b;
        b = c;
    }
    b
}

#[wasm_bindgen]
pub fn process_image(pixels: &mut [u8]) {
    // RGBA バッファをグレースケール化
    for chunk in pixels.chunks_mut(4) {
        let gray = (chunk[0] as u32 * 299
                  + chunk[1] as u32 * 587
                  + chunk[2] as u32 * 114) / 1000;
        chunk[0] = gray as u8;
        chunk[1] = gray as u8;
        chunk[2] = gray as u8;
    }
}
```

```toml
# Cargo.toml
[package]
name = "image-processor"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
```

```bash
# wasm-pack でビルド
wasm-pack build --target web
```

```typescript
// 利用側 (TypeScript)
import init, { fibonacci, process_image } from './pkg/image_processor.js';

await init();  // .wasm をロード

console.log(fibonacci(50));  // 実性能は生成コードとJS↔Wasm境界を含めて計測する

// Canvas の ImageData を直接処理
const ctx = canvas.getContext('2d')!;
const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
process_image(imgData.data);  // Rust 側で in-place 処理
ctx.putImageData(imgData, 0, 0);
```

Wasmの線形メモリはJavaScriptから`ArrayBuffer`/TypedArrayとして参照できるため、設計によっては同じメモリ領域を共有して余分なコピーを避けられる。ただし文字列変換、メモリ拡張、所有権管理、JavaScript↔Wasm境界の呼び出しではコピーや変換コストが発生し得る。Wasmが速いかどうかは、処理内容、生成コード、境界呼び出し回数、メモリアクセスに依存する [WebAssembly JavaScript API, 2026]。

#### WASI ― ブラウザの外でも Wasm

WASI (WebAssembly System Interface) は、Wasmモジュールがファイル、標準入出力、時計などのシステム機能へアクセスするためのインタフェース群である。実際に許可される能力と隔離強度は、WASIの世代、ランタイム、付与する権限、ホスト実装に依存する。「WASIを使えば自動的に安全」ではない [WebAssembly Security, 2026]。

```bash
# Wasm を Node.js で実行
node --experimental-wasi-unstable-preview1 \
  --experimental-wasm-modules \
  run.mjs
```

Fastly ComputeやFermyon SpinのようにWasmを主要な実行単位として利用するプラットフォームがある。一方、すべてのエッジ環境がWasm上に構築されているわけではなく、Cloudflare Workersの主なJavaScript実行環境はV8 isolatesで、Wasmは利用可能な機能の1つである。起動時間や隔離特性は各ランタイムとワークロードで測定する。

#### Wasm が向かない用途

- **小さな計算**: 呼び出しオーバーヘッドの方が大きい
- **DOM 操作中心**: Wasm から DOM を触るのは JavaScript 経由になり遅い
- **既に十分速い処理**: 普通の CRUD など

「**ボトルネックを計測してから Wasm 化**」が正解。「最初から Wasm」は多くの場合過剰。

#### 適用されやすい処理

- 画像・音声・動画処理
- CAD、3D、物理シミュレーション
- 圧縮、暗号、パーサー
- 既存のC/C++/RustライブラリをWebへ移植する処理

ただし、製品名だけで効果を一般化せず、対象処理をJavaScript実装と同じ入力・出力条件で計測する。

<a id="section-8-9"></a>
### 8.9 実装課題 ― ビルドツールの内側
<!-- handbook:learning {"level":"practical","minutes":250} -->

<!-- handbook:narrative-bridge {"section":"8.9"} -->
ビルドツールは多くの処理を自動化するため、成果物だけ見ても依存解析と変換の順序が分かりにくい。最小バンドラとHMRを実装し、ソースから配布物までの経路を確認する。

第8章ではバンドラ・ツリーシェイキング・HMR を見た。本節では小さなバンドラを自作し、各機能の本質を理解する。所要時間: 演習カードの推定時間の合計で8時間。

#### 課題8.1: 最小バンドラを書く (★★★)

**目的**: バンドラの本質は「**依存グラフを辿って1ファイルにまとめる**」こと。これを自作する。

<!-- handbook:exercise:start {"id":"8.1"} -->
> **演習カード 課題8.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 8.1 バンドラの基本原理 を読み、依存グラフの構築とモジュール関数への包み込みという2工程を把握しておく
> - 4.6 モジュールシステムの進化 を読み、ESM の import と CommonJS の require の違いを説明できる状態にする
> - Node.js の `fs` と `path` でファイルを再帰的に読める
> - `pnpm --filter @handbook/ch08 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] エントリファイルのパスと出力パスを引数に取るバンドラを書き、`code/ch08/my-bundler/starter/main.sh` から実行できる
> - [ ] `import { a } from './b.js'` 形式を解析して依存を再帰的に辿り、同じファイルを2度登録しない
> - [ ] 各モジュールへ 0 から始まる整数 ID を振り、依存関係を ID の参照へ書き換える
> - [ ] 出力が `require` 関数とモジュールキャッシュを含む単一ファイルになり、エントリの ID から実行が始まる
> - [ ] 生成した bundle を `node` で直接実行して期待値が出力される
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch08 run test` が全件パスする
>
> **期待出力**
>
> - テスト `minimal bundler builds dependency graph and executable bundle` が pass する
> - エントリ1つと依存1つの構成で、バンドル結果のモジュール数が 2 になる
> - `bash code/ch08/my-bundler/solution/main.sh` の実行で `bundle-result=42` が標準出力に出る
> - 出力ファイルを `node dist/bundle.js` で実行しても、ブラウザで読み込んでも同じ結果になる
>
> **観察項目**
>
> - 生成された bundle を開き、元の `import` 文が `const { add } = require(1);` のような呼び出しへ置き換わっていることを確認する
> - 同じモジュールを2箇所から import する構成を作り、モジュール ID が重複せず require キャッシュで2回目の評価が省かれることを確認する
> - 循環 import を持つファイルを与え、キャッシュへ空の `module.exports` を先に登録する順序が結果に効くことを確認する
> - `export default` や名前空間 import を含むファイルを与え、正規表現ベースの解析が対応できず壊れる境界を記録する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch08/my-bundler/solution/main.sh` を実行し、`bundle-result=42` が出て終了コードが0なら模範解答の環境は正常
> 2. `pnpm --filter @handbook/ch08 run test` を実行し、バンドラのテストが pass すれば合格
> 3. 自作バンドラの出力を `node` で実行し、バンドル前のソースを直接 `node` で実行した結果と標準出力が一致すれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 処理を「グラフを作る」と「文字列を組み立てる」の2段に完全に分ける。先に依存グラフを配列として作り、正しい ID が振られていることを確認してから出力生成へ進む
> 2. **構造**: `buildGraph(entry)` で `{ id, file, source, dependencies }` の配列を作り、訪問済みファイルは `Map<絶対パス, id>` で管理する。出力は IIFE の中に `require` とキャッシュを置き、モジュール本体を `id: (require, module, exports) => { ... }` の形で並べる
> 3. **実装の要点**: 訪問中のファイルの ID は、依存を辿る前に Map へ登録しておく。あとから登録すると循環 import で無限再帰する。相対指定の解決では拡張子なし、`.js` 付き、`index.js` の3候補を順に試す
>
> **本番利用時の警告**
>
> - 正規表現ベースの import 解析は文字列リテラルやコメント内の import も拾い、動的 import や `export *` を扱えない。実プロジェクトへ向けると壊れた出力を無言で生成するため、本番では acorn などの正式なパーサを使う
> - この出力は source map を持たないため、バンドル後のスタックトレースが元のファイル位置と対応しない。本番ビルドで source map を省くと障害調査ができなくなる
>
> **導線**
>
> - 開始地点: `code/ch08/my-bundler/starter/main.sh`
> - 模範解答: `code/ch08/my-bundler/solution/main.sh`
>
> **推定時間の内訳**: 依存グラフ構築に45分、モジュール ID 割り当てと出力テンプレート生成に55分、実行確認と循環・重複依存の検証に50分
<!-- handbook:exercise:end -->

**要件**:
- 入力: エントリポイント `.js` ファイル
- 出力: 全依存を含む単一の `.js` ファイル
- ES Modules の `import` を解析
- 各モジュールに ID を振り、ID で `require` できる関数を生成
- 結果はブラウザでそのまま動く

```bash
# 入力ファイル
echo "import { add } from './math.js'; console.log(add(1, 2));" > src/index.js
echo "export const add = (a, b) => a + b;" > src/math.js

# 自作バンドラ実行
tsx my-bundler.ts src/index.js dist/bundle.js

# 結果を Node.js でも動かせる
node dist/bundle.js  # → 3
```

**ヒント**:
1. Acorn / babel パーサで AST 取得
2. ImportDeclaration を見つけて依存ファイルを再帰探索
3. 各モジュールに ID(0、1、2、…)
4. 出力テンプレート:
```javascript
((modules) => {
  const cache = {};
  function require(id) {
    if (cache[id]) return cache[id].exports;
    const module = { exports: {} };
    cache[id] = module;
    modules[id](require, module, module.exports);
    return module.exports;
  }
  require(0);  // エントリポイント
})({
  0: (require, module, exports) => { /* index.js のコード */ },
  1: (require, module, exports) => { /* math.js のコード */ },
});
```

模範解答: `code/ch08/my-bundler/`

#### 課題8.2: ツリーシェイキングを観察する (★★)

**目的**: 「**使わないコードが消える**」とはどういうことか、実物を見る。

<!-- handbook:exercise:start {"id":"8.2"} -->
> **演習カード 課題8.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 8.5 ツリーシェイキング を読み、静的解析可能な ESM が前提であることを把握しておく
> - 8.3 esbuild と SWC ― ネイティブ実装の衝撃 を読み、比較対象となるツールの立ち位置を確認しておく
> - `bash` と `node` が使え、`code/ch08/tree-shaking/solution/main.sh` を実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 複数の export を持つモジュールを用意し、そのうち1つだけを named import する入口ファイルを作る
> - [ ] 未使用 export が出力から消えることを、`grep` による存在確認で二値判定している
> - [ ] 除去前後のバイト数を計測し、削減バイト数を記録している
> - [ ] 生成物を `node` で実行して、残した関数の結果が正しいこと (例: 期待値 42) を確認している
> - [ ] ESM と CJS の差、副作用コードが消えない理由、`"sideEffects": false` の役割の3点について、観察に基づく回答をメモに書いている
>
> **期待出力**
>
> - `before=`、`after=`、`removed=` の3つの数値を含む1行が出力され、removed が正の値になる
> - `tree-shaken-result=42` が標準出力に出る
> - 出力ファイルに対する `grep -q 'unusedLargeFeature'` が不一致 (終了コード1) になる
> - テスト `tree shaker removes unused exported functions` が pass する
>
> **観察項目**
>
> - 未使用関数の中から `console.log` などの副作用を呼び出す形へ書き換え、除去の判断が変わるかを確認する
> - 同じモジュールを `module.exports` 形式 (CJS) へ書き換え、静的解析で使用箇所を特定できなくなる様子を確認する
> - `npx --yes esbuild src/index.js --bundle --outfile=out/esbuild.js --minify` をネットワークが使える環境で実行し、自作除去と実ツールの出力サイズを比べる
> - エントリ側の import を `import * as lib from './library.js'` へ変え、名前空間 import でシェイクされにくくなることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch08/tree-shaking/solution/main.sh` を実行し、`tree-shaken-result=42` が出て終了コードが0なら模範解答は正常に動いている
> 2. `pnpm --filter @handbook/ch08 run test` を実行し、tree shaker のテストが pass すれば合格
> 3. 自作版の出力に対して `grep -c 'unusedLargeFeature'` を実行し、結果が 0 なら未使用 export の除去に成功している
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「消えるかどうか」を目視ではなく判定可能な形にする。出力に対する grep の終了コードと、除去前後のバイト数の2つを最初に決めておくと、以降の実験がすべて自動判定になる
> 2. **構造**: 簡易版は `export function name(...) { ... }` にマッチする正規表現でブロックを取り、使用名の集合に含まれなければ空文字へ置換し、含まれれば `export ` だけを外す方針で書ける
> 3. **実装の要点**: この単純な正規表現はネストした波括弧を含む関数本体を正しく取れない。実験用モジュールは1階層の本体に留め、限界に当たった時点で本物のバンドラの AST 解析が必要になる理由を記録する
>
> **本番利用時の警告**
>
> - この簡易シェイカは正規表現で関数ブロックを削るため、文字列やコメントに含まれる波括弧で誤爆し、必要なコードを消したまま気付かない出力を作る。本番ビルドでは必ず実ツールの出力を検証する
> - `"sideEffects": false` を実態と異なるパッケージへ設定すると、CSS の import や polyfill が本番ビルドからだけ消え、開発環境では再現しない不具合になる
>
> **導線**
>
> - 開始地点: `code/ch08/tree-shaking/starter/main.sh`
> - 模範解答: `code/ch08/tree-shaking/solution/main.sh`
>
> **推定時間の内訳**: 実験用モジュールと入口の作成に20分、除去処理と grep 判定の実装に35分、CJS 比較と副作用ケースの観察、回答の記述に35分
<!-- handbook:exercise:end -->

**手順**:
1. `code/ch08/tree-shaking/` に複数の export がある module を用意
2. ESM の named import で 1 つだけ使う
3. esbuild、Rollup、Vite それぞれでビルド
4. 出力ファイルから「使われない関数」が消えているか確認

```bash
# esbuild でバンドル
npx esbuild src/index.js --bundle --outfile=out/esbuild.js --minify
# Rollup
npx rollup src/index.js -o out/rollup.js -f esm
```

**問題**:
- ESM vs CJS でどちらがツリーシェイクされやすいか?
- 副作用のあるコード (`module.sideEffect.run()`) はなぜシェイクされにくいか?
- `package.json` の `"sideEffects": false` の役割は?

模範解答: `code/ch08/tree-shaking/solution.md`

#### 課題8.3: 簡易 HMR を実装 (★★★)

**目的**: HMR の核は「**モジュールを差し替え、依存元に再評価させる**」だけ。これを自作する。

<!-- handbook:exercise:start {"id":"8.3"} -->
> **演習カード 課題8.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 8.7 HMR (Hot Module Replacement) を読み、モジュールの差し替えと状態保持の関係を把握しておく
> - 8.4 Vite ― 開発体験の革新 を読み、開発サーバがブラウザへ直接 ESM を配る仕組みを確認しておく
> - Node.js の `http` と `fs.watch` でサーバとファイル監視を書ける
> - `pnpm --filter @handbook/ch08 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch08/mini-hmr/starter/main.ts` に HTTP サーバを実装し、`/module.js` で対象モジュールのソースを `text/javascript` として配信する
> - [ ] 更新通知用のエンドポイント (`/events` の Server-Sent Events もしくは WebSocket) を持ち、接続中のクライアントを集合で管理する
> - [ ] `fs.watch` でファイル変更を検知し、接続中の全クライアントへ更新メッセージを送る
> - [ ] クライアントスクリプトが `import(url + '?t=' + timestamp)` で新しいモジュールを取り込み、`location.reload` を一切呼ばない
> - [ ] サーバの `close()` で監視とリスナーを解放し、テスト実行後にプロセスが残らない
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch08 run test` が全件パスする
>
> **期待出力**
>
> - テスト `HMR server serves module and client avoids full reload` が pass する
> - `http://127.0.0.1:<port>/module.js` を fetch すると、監視対象ファイルの中身がそのまま返る
> - クライアントスクリプトの文字列に `EventSource` が含まれ、`location.reload` が含まれない
> - ファイル保存のたびにブラウザのコンソールへ `hmr-ms` と所要ミリ秒が出力される
>
> **観察項目**
>
> - `hmr-ms` の値とページ全体をリロードしたときの読み込み時間を比べ、差し替えの方が短いことを実測で確認する
> - 動的 import のクエリ文字列 (`?t=`) を外して保存し、モジュールキャッシュが効いて古いコードが実行され続けることを確認する
> - 更新前のモジュールが持っていたカウンタなどの状態が、差し替え後にリセットされることを確認して状態保持の難しさを記録する
> - レスポンスヘッダの `Cache-Control: no-store` を外し、ブラウザキャッシュによって更新が届かなくなる様子を Network タブで確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch08 run test` を実行し、HMR のテストが pass すれば合格
> 2. 監視対象の小さなモジュールを1つ用意し、`pnpm --filter @handbook/ch08 exec tsx mini-hmr/solution/main.ts <モジュールのパス>` で起動して、表示された URL をブラウザで開ける
> 3. 開いたページを見たままエディタでモジュールを保存し、リロードなしで描画が変わり `hmr-ms` がコンソールへ出れば合格
> 4. サーバを Ctrl+C で止めたあと `lsof -i :3001` などで待ち受けが残っていなければ、後始末が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 配信・通知・差し替えの3つを混ぜない。まず `/module.js` を返すだけのサーバを立て、ブラウザから読めることを確認してから通知経路を足す
> 2. **構造**: 通知は WebSocket でなくても Server-Sent Events で足りる。`text/event-stream` のレスポンスを開いたまま `Set<ServerResponse>` に保持し、変更時に `data: {json}` を書き込む。クライアント側は `EventSource` の onmessage で動的 import する
> 3. **実装の要点**: 動的 import は URL 単位でキャッシュされるため、必ず `?t=` にタイムスタンプを付けて別 URL にする。加えて `fs.watch` は1回の保存で複数回発火する環境があるので、短時間の重複通知を無視する処理が要る
>
> **本番利用時の警告**
>
> - この開発サーバはパスの検証を持たず、監視対象以外のファイルを返す実装へ広げるとディレクトリトラバーサルでソースや秘密情報を配信してしまう。必ず localhost バインドのまま開発時だけ使う
> - モジュールを差し替えても古いモジュールのクロージャやイベントリスナーは解放されない。本番ビルドに HMR ランタイムを含めると、メモリリークと二重登録を抱えたコードを配布することになる
>
> **導線**
>
> - 開始地点: `code/ch08/mini-hmr/starter/main.ts`
> - 模範解答: `code/ch08/mini-hmr/solution/main.ts`
>
> **推定時間の内訳**: モジュール配信サーバの実装に40分、SSE による更新通知とクライアントスクリプトに55分、差し替え計測とキャッシュ・後始末の検証に55分
<!-- handbook:exercise:end -->

**要件**:
- WebSocket サーバ + クライアント
- ファイル変更を検知 (chokidar など)
- 変更されたモジュールをクライアントに送信
- クライアントは `<script type="module">` で動的読み込み

```typescript
// クライアント側
const hmrSocket = new WebSocket('ws://localhost:3001');
hmrSocket.onmessage = (event) => {
  const { type, file, code } = JSON.parse(event.data);
  if (type === 'update') {
    // 古いモジュールを破棄して新しいコードを評価
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    import(url).then((newModule) => {
      // ホットスワップ
      console.log('Updated', file);
    });
  }
};
```

**評価基準**:
- `.js` ファイルを保存するとブラウザのコードが更新される
- ページリロードなしで反映される
- フルリロードと比べてどれくらい速いか計測

模範解答: `code/ch08/mini-hmr/`

#### 課題8.4: コード分割を実装 (★★)

**目的**: 動的 import がどう動くか、bundler がどう分割するかを観察する。

<!-- handbook:exercise:start {"id":"8.4"} -->
> **演習カード 課題8.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 8.6 コード分割 (Code Splitting) を読み、動的 import がチャンク境界になる理由を把握しておく
> - 5.4 非同期処理の進化 を読み、同じ Promise を共有して二重実行を避ける書き方を確認しておく
> - `pnpm --filter @handbook/ch08 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch08/code-splitting/starter/main.ts` にルートごとの動的 import を登録するローダを実装する
> - [ ] 同じルートを同時に2回要求してもチャンクの読み込みが1回で済み、2回目以降はキャッシュ済みの Promise を返す
> - [ ] 未登録のルートを要求したとき、ルート名を含むエラーを投げる
> - [ ] 読み込みにかかったミリ秒を計測して結果へ含める
> - [ ] 重いモジュール (例: 大きな配列を持つ admin ルート) を静的 import から動的 import へ切り替え、初期に読み込むコード量が減ったことを計測している
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch08 run test` が全件パスする
>
> **期待出力**
>
> - テスト `code splitting loader loads once and caches chunk` が pass する
> - 同じルートへ同時2件のリクエストを出したとき、ローダ関数の呼び出し回数が 1 になる
> - `navigate('/admin')` の戻り値に `Admin chunk` と `loaded in <数値> ms` が含まれる
> - 初回の読み込みミリ秒より、2回目の呼び出しのミリ秒が明確に小さくなる
>
> **観察項目**
>
> - キャッシュを外した版に変え、同時2件のリクエストでローダが2回呼ばれることを確認する
> - ブラウザ向けにビルドした場合の Network タブで、初期ロードのファイル一覧に admin 相当のチャンクが含まれず、操作後に別リクエストとして現れることを確認する
> - `await import()` を条件分岐の中に置いた場合と最上位に置いた場合で、初期バンドルに含まれる内容が変わることを確認する
> - 動的 import 中にネットワークを切り、失敗した Promise がキャッシュへ残るとリトライできなくなる問題を再現する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch08 run test` を実行し、コード分割のテストが pass すれば合格
> 2. `pnpm --filter @handbook/ch08 run typecheck` を実行し、`RouteModule` と `RouteLoader` の型でエラー0件なら合格
> 3. 存在しないルートで `navigate('/nope')` を呼び、`Unknown route: /nope` を含むエラーが投げられれば合格
> 4. ブラウザの Network タブでチャンクが操作時に初めて要求され、初期 HTML の読み込み時には現れなければ分割が効いている
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 分割の単位を先に決める。ルート単位が最も分かりやすい。まずルート名からローダ関数を引く素の Map を作り、キャッシュは後から足す
> 2. **構造**: `createRouteLoader(routes)` が `Map<string, Promise<RouteModule>>` を閉じ込めた関数を返す形にする。ローダの戻り値ではなく Promise 自体をキャッシュすると、同時要求の重複が自然に消える
> 3. **実装の要点**: 失敗した Promise をキャッシュに残すと、一時的なネットワークエラーで永久にそのルートが開けなくなる。catch でキャッシュから削除する処理を入れるかどうかを意識的に決める
>
> **本番利用時の警告**
>
> - 動的 import に失敗した場合のリトライとフォールバック UI が無いと、デプロイでハッシュ付きチャンク名が変わった瞬間に、開きっぱなしの古いタブから新しいチャンクを取得できず画面が壊れる
> - 細かく分割しすぎるとリクエスト数と往復遅延が増え、分割前より遅くなる。分割は必ず実測 (初期転送量と操作までの時間) で効果を確認してから採用する
>
> **導線**
>
> - 開始地点: `code/ch08/code-splitting/starter/main.ts`
> - 模範解答: `code/ch08/code-splitting/solution/main.ts`
>
> **推定時間の内訳**: ローダとキャッシュの実装に30分、重いモジュールの動的 import 化と計測に35分、Network タブ観察と失敗系の確認に25分
<!-- handbook:exercise:end -->

**手順**:
1. 大きなライブラリ (例: 100KB のダミーモジュール) を用意
2. 通常版: 起動時に全部ロード → バンドルサイズ計測、初期表示時間計測
3. 分割版: 必要時のみ動的 import → 同様に計測
4. ネットワークタブで chunk が分かれているのを確認

```typescript
// 通常版(全部一度に)
import { heavyFeature } from './heavy';
button.onclick = () => heavyFeature();

// 分割版(クリック時にロード)
button.onclick = async () => {
  const { heavyFeature } = await import('./heavy');
  heavyFeature();
};
```

模範解答: `code/ch08/code-splitting/`

---

<!-- handbook:code-usage:start {"chapter":8} -->
### 第8章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第8章の模範解答をまとめて検証する
pnpm --filter @handbook/ch08 run test

# 模範解答を個別に実行する
bash code/ch08/my-bundler/solution/main.sh                             # 課題8.1
bash code/ch08/tree-shaking/solution/main.sh                           # 課題8.2
pnpm --filter @handbook/ch08 exec tsx mini-hmr/solution/main.ts        # 課題8.3
pnpm --filter @handbook/ch08 exec tsx code-splitting/solution/main.ts  # 課題8.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch08/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-9"></a>
## 第9章 レンダリング戦略

第8章で、アプリケーションコードをブラウザへ配布できる形に変換する工程を理解した。しかし、配布できることと、利用者が早く内容を見られることは同じではない。すべてをブラウザで実行すればサーバは単純になるが、初期表示までJavaScript実行を待つ。サーバでHTMLを作れば初期表示は改善するが、サーバ負荷やハイドレーションの複雑さが増える。

本章では、このトレードオフを「HTMLをいつ、どこで生成するか」という軸で整理する。CSR、SSR、SSG、ISR、Streaming SSR、RSC、PWA (Progressive Web App) は競合する流行語ではなく、更新頻度、初期表示、インタラクション、運用コストの組み合わせに対する異なる解である。第II部の最後に、フロントエンドがどこまで責務を持ち、どこからバックエンドへ依存するのかを明確にし、第III部へ接続する。

「ReactアプリはSPAとして動く」というのは2015年頃の常識だった。現在は、同じReactコードを **CSR、SSR、SSG、ISR、RSC、Streaming SSR** と複数の方式で実行できる。本章はそれぞれの違いと使い分けを整理する。

<!-- handbook:chapter-guide:start {"chapter":9} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> SEO、初期表示、インタラクション、キャッシュ、サーバ負荷のトレードオフを、CSR/SSR/SSG/RSCなどの実行場所から選ぶ。
>
> **到達目標**
> - 主要レンダリング方式の生成時点とデータ取得位置を説明できる。
> - ハイドレーション、ストリーミング、キャッシュの失敗条件を説明できる。
> - ページ単位で方式を組み合わせる判断ができる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [6.1 Reactの登場と「単方向データフロー」](#section-6-1) ― 宣言的UI
> - [8.1 バンドラの基本原理](#section-8-1) ― ビルド工程
>
> **中核概念**  
> [9.1 CSR (Client-Side Rendering)](#section-9-1)、[9.2 SSR (Server-Side Rendering)](#section-9-2)、[9.3 SSG (Static Site Generation)](#section-9-3)、[9.5 Streaming SSR](#section-9-5) (実務選択)、[9.6 RSC (React Server Components)](#section-9-6) (発展)、[9.7 戦略の選択基準](#section-9-7)
>
> **最小実装**  
> [9.8 同じ Todo アプリを CSR / SSR / SSG で実装比較](#section-9-8) (実務選択)、[9.13 実装課題 ― レンダリング戦略を実装で比較](#section-9-13) (実務選択)
>
> **本番実装との差分**
> - 教材比較は同一機能の最小例であり、認証、CDN、データ更新、エラー回復、運用コストを含まない。
>
> **典型的な失敗**
> - サイト全体を1方式に固定する。
> - サーバとクライアントで異なる値を描画しハイドレーション不一致を起こす。
> - キャッシュ無効化を設計しない。
>
> **診断・デバッグ方法**
> - HTMLソース、Network waterfall、サーバログを合わせて生成場所を確認する。
> - JavaScript無効時と低速回線で初期表示を確認する。
>
> **意思決定チェックリスト**
> - コンテンツの更新頻度と個別化の程度は。
> - 初期HTMLに必要な情報は何か。
> - どこまでCDNで共有可能か。
>
> **演習と評価基準**  
> 対象: [9.13 実装課題 ― レンダリング戦略を実装で比較](#section-9-13) (実務選択)
> - 同一ページを複数方式で実装し、TTFB・表示・更新性を比較できる。
>
> **一次資料・発展資料**
> - React Server Components documentation
> - HTML specification
> - Service Workers specification
> - Astro documentation
<!-- handbook:chapter-guide:end -->

<a id="section-9-1"></a>
### 9.1 CSR (Client-Side Rendering)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CSR (Client-Side Rendering)"} -->

<!-- handbook:narrative-bridge {"section":"9.1"} -->
まず、HTMLを最小限にしてブラウザがJavaScriptから画面を構築するCSRを基準にする。この方式はサーバを単純にできる一方、内容表示までの依存をクライアントへ集中させる。

ブラウザがJavaScriptをダウンロード・実行してDOMを構築する方式。Create React Appが代表。

```text
[HTML] (空っぽ) → [JS をダウンロード] → [実行] → [API取得] → [描画]
```

特徴:

- **長所**: 初回以降の遷移が高速、サーバ実装が単純 (静的ファイル配信のみ)
- **短所**: 初期HTMLに主要コンテンツが含まれない構成では、JavaScriptの取得・実行完了まで表示や操作が遅れる。検索クローラや共有プレビューがJavaScriptをどこまで処理するかにも依存するため、発見性が重要なページでは事前レンダリングを検討する
- **適している**: 管理画面、認証必須のアプリ、SEO不要なツール

<a id="section-9-2"></a>
### 9.2 SSR (Server-Side Rendering)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"S","term":"SSR"} -->

<!-- handbook:narrative-bridge {"section":"9.2"} -->
CSRの初期表示待ちを減らすには、最初のHTMLをサーバで生成すればよい。ただし、表示後の操作性を引き継ぐため、同じコンポーネントをクライアント側で対応付ける必要が生じる。

サーバ側でHTMLを組み立ててから返す方式。Next.jsの `getServerSideProps`、Remix のloaderなど。

```text
[リクエスト] → [サーバでHTML構築] → [HTML返却] → [ハイドレーション]
```

**ハイドレーション**: 返ってきたHTMLにイベントハンドラなどのインタラクティブ機能を「水を加える (hydrate)」過程。サーバが出したHTMLとクライアントが描画する仮想DOMが一致する必要がある (ズレると warning が出る)。

特徴:

- **長所**: 初回HTMLにコンテンツが入っているのでSEO・初期表示に有利
- **短所**: サーバ計算コスト、レスポンスがCSRより遅い (動的処理を待つ)
- **適している**: SEO重要なページ、ECサイトの商品ページ、ブログ

<a id="section-9-3"></a>
### 9.3 SSG (Static Site Generation)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"S","term":"SSG"} -->

<!-- handbook:narrative-bridge {"section":"9.3"} -->
SSRは各リクエストでHTMLを生成するため、内容が変わらないページにも計算コストがかかる。SSGは生成時点をビルド時へ移し、静的配信の単純さと速度を得る。

ビルド時にあらかじめ HTML を全部生成しておく方式。Gatsby、Next.js の `getStaticProps`、Astro など。

```text
[ビルド時に全HTML生成] → [CDN配信]
```

特徴:

- **長所**: 最高速 (CDN配信、サーバ計算なし)、安全 (DB直接アクセスなし)
- **短所**: 内容変更にはビルドが必要、動的なコンテンツに不向き
- **適している**: ドキュメンテーション、企業サイト、変更頻度の低いブログ

<a id="section-9-4"></a>
### 9.4 ISR (Incremental Static Regeneration)
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"I","term":"ISR (Incremental Static Regeneration)"} -->

<!-- handbook:narrative-bridge {"section":"9.4"} -->
SSGは高速だが、内容更新のたびに全体ビルドが必要になる。ISRは静的成果物を再利用しつつ、期限や要求に応じて一部だけ再生成する。

SSGの拡張で、「ビルド時に生成、一定時間ごとに再生成」という方式。Next.jsが普及させた。

```typescript
// Next.js (Pages Router の例)
export async function getStaticProps() {
  const post = await fetchPost();
  return {
    props: { post },
    revalidate: 60,  // 60秒経過後に再生成
  };
}
```

- 初回ユーザーは古いキャッシュを受け取る (即返す)
- 裏側で再生成、次のユーザーが新しいバージョンを受け取る
- 全部再生成しなくていい (ページ単位の再生成)

<a id="section-9-5"></a>
### 9.5 Streaming SSR
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"S","term":"SSR"} -->
<!-- handbook:index {"group":"S","term":"Streaming SSR"} -->
<!-- handbook:index {"group":"S","term":"Suspense"} -->

<!-- handbook:narrative-bridge {"section":"9.5"} -->
SSRで完全なHTMLを待つと、遅いデータ取得がページ全体の応答を止める。Streaming SSRは準備できた部分から送り、計算と転送を重ね合わせる。

通常のSSRはサーバが全HTMLを組み立ててから一括で返す。Streaming SSRはHTMLの一部から少しずつ送る方式。

```typescript
// React 18 の renderToPipeableStream
import { renderToPipeableStream } from 'react-dom/server';

app.get('/', (req, res) => {
  const { pipe } = renderToPipeableStream(<App />, {
    bootstrapScripts: ['/main.js'],
    onShellReady() {
      // 主要なshellができたら送信開始
      res.setHeader('Content-Type', 'text/html');
      pipe(res);
    },
  });
});
```

`Suspense` の境界が、ストリーミングの単位になる。

```tsx
<Layout>
  <Header />
  <Suspense fallback={<Skeleton />}>
    {/* この中は重いデータ取得を含む */}
    <SlowDataComponent />
  </Suspense>
</Layout>
```

ヘッダは即座にHTMLが送られ、表示される。SlowDataComponentのデータが揃ったら、続きのHTMLが追加で送られる。ユーザーは「白画面 → 全部」ではなく「ヘッダ → 残り」と段階的に画面を見られる。

<a id="section-9-6"></a>
### 9.6 RSC (React Server Components)
<!-- handbook:learning {"level":"advanced","minutes":10} -->
<!-- handbook:index {"group":"R","term":"RSC (React Server Components)"} -->
<!-- handbook:index {"group":"S","term":"Server Components (RSC)"} -->

<!-- handbook:narrative-bridge {"section":"9.6"} -->
ストリーミングでHTMLを早く送れても、インタラクションに不要なコンポーネントコードまでクライアントへ渡す問題は残る。RSCは実行場所をコンポーネント単位で分け、サーバだけで完結する処理をクライアントバンドルから外す。

2023年に Next.js 13 で実用化、現在 React の中核機能の一つ。

従来のReact SSRでは、サーバでHTMLを生成した後、対応するクライアントコンポーネントのJavaScriptをブラウザへ送り、ハイドレーションして操作可能にする構成が中心だった。RSCは、サーバでのみ実行され、そのコンポーネント実装をクライアントJavaScriptへ含めない**Server Components**と、ブラウザで実行するClient Componentsを同じツリーで組み合わせる。

```tsx
// app/posts/page.tsx (Next.js App Router)
// 何も書かなければ Server Component
async function PostsPage() {
  // サーバ側でDBに直接アクセス
  const posts = await db.posts.findMany();
  return (
    <ul>
      {posts.map(p => <PostCard key={p.id} post={p} />)}
    </ul>
  );
}
```

```tsx
// PostCard.tsx
'use client';  // この宣言でClient Componentになる
import { useState } from 'react';

export function PostCard({ post }: { post: Post }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li onClick={() => setExpanded(!expanded)}>
      {/* インタラクションが必要なのでクライアント */}
    </li>
  );
}
```

**メリット:**

- DBアクセスをコンポーネントから直接書ける (バックエンドAPIが不要なケースも)
- 大きなライブラリ (Markdown パーサーなど) をクライアントに送らずに済む
- バンドルサイズが小さくなる

**注意**:

- Server Component は `useState`、`useEffect` などのフックが使えない
- イベントハンドラ (`onClick` など) も使えない (送れないため)
- `'use client'` をつけたコンポーネントから先は、その配下も「クライアントへの境界」になる

RSCの実装APIにはフレームワーク依存部分があり、ReactのServer Functionsを支えるバンドラAPIの一部はReact 19.xでも固定されたsemver契約ではない。採用時はReactとフレームワークの対応バージョンを固定し、移行ガイドを確認する [React Server Functions, 2026]。

<a id="section-9-7"></a>
### 9.7 戦略の選択基準
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"Cohort Retention"} -->

<!-- handbook:narrative-bridge {"section":"9.7"} -->
各方式の仕組みを理解した後に必要なのは、どれが最良かではなく、どの制約で選ぶかである。更新頻度、個別化、SEO、サーバ負荷、操作開始時間を同じ表で比較する。

ページごとに戦略を選ぶのが正解。Next.jsはこれを混在可能にしている。

| ページの性質 | 推奨戦略 |
|---|---|
| 利用規約、会社情報 (滅多に更新しない) | SSG |
| ブログ記事 (更新あり、SEO重要) | SSG / ISR |
| 商品ページ (在庫リアルタイム性) | SSR / ISR |
| ダッシュボード (認証必須) | CSR / SSR |
| ECの検索結果 (動的、SEOも欲しい) | SSR + Streaming |
| ニュースサイト (記事は静的、コメントは動的) | RSC + Client Components |

<a id="section-9-8"></a>
### 9.8 同じ Todo アプリを CSR / SSR / SSG で実装比較
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"9.8"} -->
抽象的な比較だけでは、ネットワーク要求数や表示タイミングの差を実感しにくい。同じ機能を複数方式で実装し、方式以外の条件を揃えて観測する。

**CSR (Vite + React):**

```tsx
// App.tsx
function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  useEffect(() => {
    fetch('/api/todos').then(r => r.json()).then(setTodos);
  }, []);
  return <TodoList todos={todos} />;
}
```

初回はAPIフェッチが終わるまでリストは空のまま。

**SSR (Next.js Pages Router):**

```tsx
// pages/todos.tsx
export const getServerSideProps: GetServerSideProps = async () => {
  const todos = await fetch('http://api/todos').then(r => r.json());
  return { props: { todos } };
};

export default function TodosPage({ todos }: { todos: Todo[] }) {
  return <TodoList todos={todos} />;
}
```

最初のHTMLにTodosが入っているので、画面表示時点で既に内容がある。

**SSG (Next.js):**

```tsx
export const getStaticProps: GetStaticProps = async () => {
  const todos = await fetch('http://api/todos').then(r => r.json());
  return { props: { todos }, revalidate: 60 };  // ISR (1分ごとに再生成)
};
```

ビルド時に生成されたHTMLを返す。CDN (Content Delivery Network) へ配置しやすく、リクエストごとのサーバレンダリングを避けられるため、静的に生成可能なページでは初回応答を短くしやすい。

**RSC (Next.js App Router):**

```tsx
// app/todos/page.tsx
export default async function TodosPage() {
  // サーバ側でDB直接アクセス
  const todos = await db.todos.findMany();
  return <TodoList todos={todos} />;
}
```

API層を介さずDB直接アクセス、しかもJavaScriptもクライアントに送らない (List がインタラクティブでなければ)。

<a id="section-9-9"></a>
### 9.9 Astro ― コンテンツ中心のWebに最適化
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"A","term":"Astro"} -->

<!-- handbook:narrative-bridge {"section":"9.9"} -->
ページ全体で一つのレンダリング方式を選ぶ必要はない。Astroはコンテンツを静的HTMLとして優先し、操作が必要な部分だけを島としてハイドレートする。

Astroは「**島アーキテクチャ (Islands Architecture)**」を採用する。

```astro
---
// この上部分はサーバ側だけで実行 (フロントマター)
const posts = await fetchPosts();
---

<html>
  <body>
    <h1>Blog</h1>
    <ul>
      {posts.map(p => <li>{p.title}</li>)}
    </ul>
    <!-- インタラクティブな部分だけ「島」として hydrate -->
    <Counter client:load />
  </body>
</html>
```

Astroでは、UIコンポーネントをサーバ側でHTMLへレンダリングし、`client:*`ディレクティブを付けた島だけをクライアントでハイドレートできる。要件次第でクライアントJavaScriptを小さくできるが、性能はコンポーネント、画像、フォント、サードパーティスクリプト、キャッシュにも依存する。Next.js等との優劣は同じ要件と計測条件で比較する。

<a id="section-9-10"></a>
### 9.10 PWA (Progressive Web Apps) ― Webをアプリ化する
<!-- handbook:learning {"level":"practical","minutes":40} -->
<!-- handbook:index {"group":"B","term":"Background Sync"} -->
<!-- handbook:index {"group":"D","term":"Dexie"} -->
<!-- handbook:index {"group":"I","term":"IndexedDB"} -->
<!-- handbook:index {"group":"M","term":"Manifest (Web App)"} -->
<!-- handbook:index {"group":"P","term":"PWA"} -->
<!-- handbook:index {"group":"S","term":"Service Worker"} -->
<!-- handbook:index {"group":"W","term":"Workbox"} -->

<!-- handbook:narrative-bridge {"section":"9.10"} -->
レンダリング方式を最適化しても、ネットワークが切れればWebアプリは利用できない。PWAはService Workerとキャッシュを使い、配信後の実行環境へオフライン性とインストール性を加える。

PWAは、Webアプリへインストール、オフライン利用、通知などの能力を段階的に追加する設計アプローチである。すべてのPWAが同じ機能を備えるわけではなく、ブラウザ、OS、配布方法、権限によって利用可能な能力が異なる。

#### PWAの構成要素

代表的な構成要素:

1. **Web App Manifest** ― 名前、アイコン、表示モードなどのインストール情報
2. **Service Worker** ― リクエスト制御、キャッシュ、Pushなどのイベント処理
3. **セキュアコンテキスト** ― Service Worker等の強力なAPIを利用する前提 (`localhost`等の例外を除く)
4. **通常のWebフォールバック** ― 未対応環境でも基本機能を利用できるプログレッシブエンハンスメント

#### Web App Manifest

```json
{
  "name": "My SaaS App",
  "short_name": "MySaaS",
  "description": "Cloud-based task management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066cc",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-mask.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screen-1.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide" }
  ]
}
```

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0066cc">
```

これでブラウザに「**ホーム画面に追加**」ボタンが表示され、インストールできるようになる。

#### Service Worker ― オフライン対応の核

Service Workerはブラウザのバックグラウンドで動くスクリプト。ネットワークリクエストを傍受して、キャッシュからの返却・オフライン処理・プッシュ通知などを担う。

```typescript
// /sw.js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/main.css',
  '/main.js',
  '/manifest.json',
  '/offline.html',
];

// インストール: 静的アセットをキャッシュ
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// アクティベート: 古いキャッシュを掃除
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

// フェッチ: ネットワーク優先、失敗したらキャッシュ
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  // API リクエスト: Network First (新鮮さ優先)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // 成功したらキャッシュも更新
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 静的アセット: Cache First (速度優先)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('/offline.html'));
    })
  );
});
```

#### 登録側 (アプリ)

```typescript
// main.ts
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', reg);
    } catch (e) {
      console.error('SW registration failed:', e);
    }
  });
}
```

#### キャッシュ戦略パターン

- **Cache First**: キャッシュ → なければネットワーク (静的アセット)
- **Network First**: ネットワーク → 失敗時キャッシュ (動的データ)
- **Stale While Revalidate**: 即座にキャッシュ返す + バックグラウンドで更新
- **Cache Only**: 完全オフライン専用 (事前に同期したデータ)
- **Network Only**: キャッシュしない (POST など)

実装が複雑になりがちなので、**Workbox** ライブラリを使うのが現代の定石。

```typescript
// vite.config.ts (vite-plugin-pwa)
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.myapp\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 86400 },
            },
          },
        ],
      },
    }),
  ],
};
```

#### IndexedDB ― ローカルでデータ永続化

`localStorage`は同期APIで文字列を保存するため、大量データや頻繁な読み書きには向かない。保存容量の上限はブラウザ、オリジン、端末の空き容量やポリシーで異なる。構造化データと非同期トランザクションが必要なら**IndexedDB**を使い、必要に応じてDexieや`idb`でAPIを扱いやすくする。

```typescript
import { openDB } from 'idb';

const db = await openDB('myapp', 1, {
  upgrade(db) {
    const store = db.createObjectStore('tasks', { keyPath: 'id' });
    store.createIndex('by-status', 'status');
  },
});

// 書き込み
await db.put('tasks', { id: '1', title: 'Buy milk', status: 'todo' });

// 読み込み
const task = await db.get('tasks', '1');

// インデックスで検索
const todos = await db.getAllFromIndex('tasks', 'by-status', 'todo');
```

#### Background Sync ― オフラインで作った変更を同期

対応ブラウザでは、ユーザーがオフライン中に作成した操作を接続回復後に送るためBackground Syncを利用できる。ただし対応しない環境もあるため、送信待ちデータをOutboxとして永続化し、アプリ起動時・オンライン復帰時・ユーザー操作でも再送できる設計を併用する。再送されるAPIは冪等にする。

```typescript
// アプリ側
const reg = await navigator.serviceWorker.ready;
await db.put('pendingActions', { type: 'create-task', data: { title: '...' } });
await (reg as any).sync.register('sync-tasks');

// Service Worker 側
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncPendingTasks());
  }
});

async function syncPendingTasks() {
  const actions = await db.getAll('pendingActions');
  for (const action of actions) {
    try {
      await fetch('/api/tasks', { method: 'POST', body: JSON.stringify(action.data) });
      await db.delete('pendingActions', action.id);
    } catch {
      // 次の同期で再試行
    }
  }
}
```

#### プッシュ通知

Push APIと通知が利用可能な環境では、ページを開いていない間にService WorkerがPushイベントを処理できる場合がある。ブラウザとOSの制限、ユーザー権限、配信停止、バッテリー最適化を前提にし、通知以外の連絡手段も用意する。許可要求は価値を説明した後のユーザー操作に応じて行う。

```typescript
// 通知許可を求める
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });
  // sub をサーバに保存
  await fetch('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
}
```

```typescript
// Service Worker
self.addEventListener('push', (event: any) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

#### PWA vs ネイティブアプリ

| | PWA | ネイティブ |
|---|---|---|
| 開発・配布 | Webの配信基盤を共有しやすいが、端末差の検証が必要 | OS別SDKやストア審査、クロスプラットフォーム基盤など選択肢がある |
| 更新 | サーバ配信で更新しやすい | ストア配信や審査ポリシーの影響を受ける場合がある |
| 端末機能 | Web APIと権限・OS制限の範囲 | OS SDKへ広くアクセスできる |
| オフライン | Service Worker、Cache、IndexedDBを設計する | OS標準機能とローカルDBを利用できる |
| 適合性 | URL共有、段階的導入、既存Web資産を重視する場合 | 高度な端末統合、バックグラウンド処理、ストア流通を重視する場合 |

選択は会社規模ではなく、必要な端末API、オフライン要件、配布経路、更新頻度、アクセシビリティ、運用体制をもとに決める。

<a id="section-9-11"></a>
### 9.11 React の Concurrent Features ― Suspense と useTransition
<!-- handbook:learning {"level":"advanced","minutes":30} -->
<!-- handbook:index {"group":"C","term":"Comlink (Web Workers)"} -->
<!-- handbook:index {"group":"S","term":"Server Actions (React)"} -->
<!-- handbook:index {"group":"S","term":"Shared Worker"} -->
<!-- handbook:index {"group":"S","term":"Suspense"} -->
<!-- handbook:index {"group":"U","term":"useDeferredValue"} -->
<!-- handbook:index {"group":"U","term":"useTransition"} -->
<!-- handbook:index {"group":"W","term":"Web Workers"} -->
<!-- handbook:index {"group":"わ行","term":"ワーカースレッド (Web Workers)"} -->
<!-- handbook:index {"group":"は行","term":"並行レンダリング (React)"} -->

<!-- handbook:narrative-bridge {"section":"9.11"} -->
高速に配信できても、重い更新がメインスレッドを占有すれば操作は止まる。Concurrent Featuresは更新の優先度を分け、緊急でない描画を中断可能にする。

9.5 Streaming SSR と 9.6 RSC で **Suspense** が前提として登場したが、ここでその中身を扱う。React 18 で導入された **Concurrent Features** は、現代の React アプリの基盤になっている。

#### Suspense ― 「読み込み中」の宣言的表現

伝統的なローディング表示:

```tsx
function UserProfile({ id }) {
  const { data, isLoading } = useUserQuery(id);
  if (isLoading) return <Skeleton />;
  return <Profile data={data} />;
}
```

各コンポーネントが `isLoading` を扱う必要があり、ローディング状態が散らばる。

Suspense を使った宣言的表現:

```tsx
function UserPage({ id }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile id={id} />
    </Suspense>
  );
}

function UserProfile({ id }) {
  // データが届くまで「サスペンド」する
  const data = use(fetchUser(id));  // React 19 の use() フック
  return <Profile data={data} />;
}
```

Suspense対応フレームワークやReactの`use`は、キャッシュされたPromiseを読み取り、完了していなければ最寄りのSuspense境界を待機状態にする。利用者が任意のPromiseを毎レンダーで生成して手動throwする方式は、キャッシュ不整合や無限リトライを招くため避ける [React Suspense, 2026]。

#### ネストした Suspense

```tsx
function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UserInfo />          {/* 早く取れる */}
      <Suspense fallback={<ChartsSkeleton />}>
        <Charts />          {/* 時間がかかる */}
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <ActivityFeed />    {/* 時間がかかる */}
      </Suspense>
    </Suspense>
  );
}
```

「**できたところから順に表示**」が自然に書ける。これが Streaming SSR (9.5) と組み合わさることで、HTML がチャンク単位で順次配信される。

#### useTransition ― 重い更新を「優先度低」にする

```tsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [resultsQuery, setResultsQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSearch(input: string) {
    setQuery(input);  // 即時更新(優先度高)

    startTransition(() => {
      // 状態更新を非緊急なTransitionとして扱う
      setResultsQuery(input);
    });
  }

  return (
    <>
      <input value={query} onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <Results query={resultsQuery} />
    </>
  );
}
```

**通常のレンダリング:**
- ユーザーが入力 → 結果フィルタリング (重い) → 入力欄も更新

**Transitionを使った場合:**
- 入力値の更新は緊急な更新として処理する
- 結果表示に関する状態更新は中断可能なTransitionとしてレンダリングする

`startTransition`はコールバックを別スレッドへ送らず、コールバック自体は直ちに実行される。イベントハンドラ内で重い`expensiveFilter`を同期実行すれば入力は依然としてブロックされる。重い計算はメモ化、データ構造の改善、分割、Web Workerを検討する [React useTransition, 2026]。

#### useDeferredValue

「値を遅らせる」シンプルな API:

```tsx
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => filterItems(deferredQuery), [deferredQuery]);

  return <List items={results} />;
}
```

入力が速いとき、フィルタリングは前の値で実行され、UI のレスポンスを優先する。

#### React Server FunctionsとActions

React 19では、`"use server"`でマークした非同期関数をクライアントから呼び出せる**Server Functions**が提供される。フォームの`action`やActionの文脈で使われるServer FunctionをServer Actionと呼ぶ。通信方式、ルーティング、CSRF (Cross-Site Request Forgery) 対策、キャッシュ更新はフレームワーク実装に依存する [React Server Functions, 2026]。

```tsx
// app/posts/new/page.tsx (Server Component)
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

async function createPost(formData: FormData) {
  'use server';  // この関数はサーバで実行される

  const title = formData.get('title') as string;
  const body = formData.get('body') as string;

  await db.post.create({ data: { title, body, authorId: getCurrentUserId() } });
  revalidatePath('/posts');  // キャッシュ更新
}

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="body" required />
      <button type="submit">投稿</button>
    </form>
  );
}
```

`'use server'`を付けた関数は、フレームワークがクライアントから呼び出すための参照とネットワーク処理を生成する。通常の公開REST APIと同じURL契約になるとは限らない。引数はネットワーク越しの未信頼入力として扱い、関数内で認証・認可・検証を行う。

**利点:**

- API ルートを別途定義しなくていい
- 同じコードベース内で型情報を共有しやすい。ただし実行時検証は別途必要
- フレームワークとフォームの構成によっては、JavaScript読み込み前でも送信できるプログレッシブエンハンスメントを実現できる

**注意**:

- 認可ロジックを各 Server Action 内で明示する (13.11 の中央集権化の話)
- フォームバリデーションは Zod 等で
- フレームワークのOrigin検証やCSRF対策を確認し、それだけに依存せずSameSite Cookie、CSRFトークン、再認証などを要件に応じて組み合わせる

#### Web Workers ― 重い計算を別スレッドで

Service Worker は「**ネットワークプロキシ**」だったが、**Web Workers** は「**汎用の別スレッド**」。CPU 負荷の高い処理を UI スレッドから分離する。

```typescript
// worker.ts
self.addEventListener('message', (event) => {
  const result = expensiveComputation(event.data);
  self.postMessage(result);
});

// main.ts
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

worker.postMessage({ input: 'data' });
worker.addEventListener('message', (event) => {
  console.log('Result:', event.data);
});
```

**Comlink** ライブラリでより自然に書ける:

```typescript
// worker.ts
import * as Comlink from 'comlink';

class Calculator {
  async compute(n: number): Promise<number> {
    // 重い計算
    return result;
  }
}

Comlink.expose(new Calculator());

// main.ts
import * as Comlink from 'comlink';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const api = Comlink.wrap<Calculator>(worker);

const result = await api.compute(1000000);  // メソッド呼び出しのように
```

**用途:**

- 暗号化/復号 (クライアントサイド E2E 暗号化)
- 大量データの解析 (数十万件のフィルタ・ソート)
- 画像処理、動画エンコード
- AI 推論 (WebGPU + Transformers.js など)

#### Shared Workers と Service Workers の違い

| | Web Worker | Shared Worker | Service Worker |
|---|---|---|---|
| 寿命 | タブ起動中 | 複数タブ共有、ブラウザ閉じるまで | 永続 (ブラウザ閉じても残る) |
| 用途 | 重い計算 | タブ間共有データ・状態 | オフライン・PWA |
| API アクセス | DOM 不可 | DOM 不可 | DOM 不可 |
| 例 | 画像処理 | 複数タブで状態同期 | キャッシュ、Push 通知 |

<a id="section-9-12"></a>
### 9.12 Storybook ― コンポーネント駆動開発の中核
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"S","term":"Storybook"} -->
<!-- handbook:index {"group":"か行","term":"コンポーネント駆動開発"} -->

<!-- handbook:narrative-bridge {"section":"9.12"} -->
実行時性能を整えた後も、コンポーネントの状態をアプリ全体の中だけで確認すると、再現とレビューが難しい。Storybookは部品を独立した入力条件で表示し、設計・検証・共有の単位にする。

「**コンポーネントを単独で開発・テスト・ドキュメント化する**」ためのツール。React、Vue、Svelte、Angular など主要フレームワークに対応。

#### Storybook の意義

通常のコンポーネント開発はアプリの中に組み込んで動作確認するが、これには問題がある:

- アプリ全体を立ち上げないと確認できない (時間がかかる)
- エッジケース (エラー状態、ローディング、空配列) を再現しにくい
- デザイナーやプロダクトマネージャーがレビューしづらい
- 他のコンポーネントへの依存が暗黙的になる

Storybook はこれを解決する:

- 各コンポーネントを**独立したサンドボックス**で表示
- props のパターンごとに**ストーリー**を作成
- インタラクションテストとして動作確認
- ビジュアル回帰テスト (Chromatic と統合)
- アクセシビリティチェック (@storybook/addon-a11y)

#### 基本的な書き方

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['small', 'medium', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// 各ストーリー = 1つの状態
export const Primary: Story = {
  args: { children: '送信', variant: 'primary' },
};

export const Disabled: Story = {
  args: { children: '送信', variant: 'primary', disabled: true },
};

export const Loading: Story = {
  args: { children: '送信中...', variant: 'primary', loading: true },
};

// 複合パターン
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};
```

これで各パターンが Storybook UI に表示され、クリックで切り替えられる。デザイナー・PM・開発者が同じ画面を見て話せる。

#### インタラクションテスト

```tsx
export const ClickToSubmit: Story = {
  args: { children: '送信', onClick: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: '送信' });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

Storybookの現行テストAPIでは`storybook/test`からTesting Library互換の操作やexpectを利用して`play`関数を書ける。利用するStorybookのメジャーバージョンに合わせて移行ガイドを確認し、ブラウザ実行やVitest連携で検証する。

#### コンポーネント駆動開発 (Component-Driven Development, CDD)

Storybook が広めた開発スタイル:

1. **小さい部品から作る**: Button → Card → Form → Page
2. **デザインシステムを実装で表現**: Figma の component と1対1
3. **テストはストーリーから始める**: 各ストーリーがすでにテストケース
4. **デザインレビューは Storybook で**: 動くプロダクトを見る前にコンポーネントレベルで合意

Storybookはコンポーネントカタログ、ドキュメント、インタラクションテストを同じストーリーから構築できる代表的な選択肢である。採用時は、既存テスト基盤、ビルド時間、デザイナーとのレビュー方法、アップグレード負担を確認する [Storybook Test, 2026]。

#### 似たツール

- **Histoire**: Vue 向け、Vite ベース、軽量
- **Ladle**: React 向け、Storybook 互換だが軽量
- **Bit**: コンポーネントごとに独立した npm パッケージ化

複雑性が増したと感じたら検討する。導入済みのテスト基盤やレビュー手順と噛み合うかが判断材料になる。

<a id="section-9-13"></a>
### 9.13 実装課題 ― レンダリング戦略を実装で比較
<!-- handbook:learning {"level":"practical","minutes":205} -->

<!-- handbook:narrative-bridge {"section":"9.13"} -->
レンダリング戦略は、図で比較するだけでは運用上の差まで分からない。同じアプリを複数方式で実装し、初期表示、操作開始、更新、オフラインの挙動を実測する。

第9章では CSR/SSR/SSG など様々なレンダリング戦略を見た。本節では、**同じ Todo アプリを4方式で実装**し、その差を体感する。所要時間: 演習カードの推定時間の合計で6時間30分。

#### 課題9.1: 4方式の Todo アプリ実装と性能比較 (★★★)

**目的**: CSR/SSR/SSG/PWA の挙動の違いを実測で確認。

<!-- handbook:exercise:start {"id":"9.1"} -->
> **演習カード 課題9.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost、Chrome
>
> **前提**
>
> - 9.1 CSR (Client-Side Rendering)、9.2 SSR (Server-Side Rendering)、9.3 SSG (Static Site Generation) を読み、HTML の生成時点とデータ取得位置の違いを説明できる状態にする
> - 9.8 同じ Todo アプリを CSR / SSR / SSG で実装比較 を読み、同一機能を方式だけ変えて比較する条件を把握しておく
> - Chrome DevTools の Network、Performance、Lighthouse パネルを開いて計測できる
> - `curl` が使え、ローカルで4つのポートを同時に立ち上げられる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] Todo 一覧・追加・完了切替の同一機能を CSR、SSR、SSG、PWA の4方式で動かせる状態にする
> - [ ] 4方式でデータ件数、スタイル、ネットワーク条件 (DevTools のスロットリング設定) をそろえて計測している
> - [ ] FCP、TTI、HTML サイズ、サーバ処理時間、オフライン可否、ハイドレーション時間の6項目を4方式ぶん表に埋めている
> - [ ] SSR と SSG では初期 HTML の中に Todo のテキストが含まれ、CSR では含まれないことを HTML ソースで確認している
> - [ ] PWA 版だけがネットワークを切っても一覧を表示できることを確認している
> - [ ] 初期表示・SEO・動的更新それぞれで有利な方式と、その理由を計測値を根拠に書き出している
>
> **期待出力**
>
> - CSR の初期 HTML は空のコンテナのみで、`curl` で取得したバイト数が他方式より明確に小さい
> - SSR と SSG の初期 HTML には Todo の件数と同じ数の `<li>` が含まれる
> - SSG の TTFB が最も小さく、SSR は毎リクエストの生成時間ぶんだけ大きい値になる
> - オフラインにすると CSR・SSR・SSG は失敗し、PWA だけがキャッシュから一覧を返す
> - CSR を除く3方式でハイドレーション時間が Performance パネルのスクリプト実行区間として観測できる
>
> **観察項目**
>
> - 各方式のページで JavaScript を無効化して再読み込みし、何が表示され何が消えるかを比べる
> - DevTools の Network で Slow 4G のスロットリングをかけ、方式間の初期表示差が拡大することを確認する
> - Performance パネルで、SSR 版の First Paint とインタラクション可能になる時点の間にハイドレーションの区間があることを確認する
> - Todo を追加したときのリクエスト数と再描画範囲を Network と Elements で比べ、更新の得意不得意を記録する
> - SSG 版でビルド後にデータだけ変更し、再ビルドするまで内容が古いままであることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. 各方式に対し `curl -s -o /dev/null -w "ttfb=%{time_starttransfer} size=%{size_download}\n" http://localhost:<port>/` を実行し、TTFB と HTML サイズが表に転記できれば計測手順は成立している
> 2. `curl -s http://localhost:<port>/ -o page.html` で初期 HTML を保存し `grep -c "<li>" page.html` を4方式で実行して、CSR が 0、SSR と SSG が Todo 件数と一致すれば生成時点の判定は正しい
> 3. DevTools の Lighthouse を同一条件 (モバイル、スロットリングあり) で4方式へ実行し、FCP と TTI が表に埋まれば合格
> 4. DevTools の Network で Offline にチェックを入れて再読み込みし、PWA 版だけが一覧を描画できれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に「変えない条件」を固定する。Todo の件数、スタイル、フォント、スロットリング設定、計測回数を決めてから実装に入らないと、あとの数値が比較不能になる
> 2. **構造**: SSR 版は `code/ch09/mini-ssr/solution/main.ts` の `renderPage` と `startServer` を、PWA 版は `code/ch09/pwa-service-worker/solution/main.js` を土台にできる。CSR 版は同じ描画関数をブラウザ側で呼び、SSG 版はビルド時に同じ関数で HTML を書き出す形にすると、方式以外の差が消える
> 3. **実装の要点**: 計測は1回では判断しない。各方式5回計測して中央値を採り、ブラウザのキャッシュを毎回クリアする。キャッシュを残したまま2回目を測ると、SSG と PWA が不当に速く見える
>
> **本番利用時の警告**
>
> - この比較は認証、CDN、実データ量、同時アクセスを含まない最小例で、計測はローカルの1台に閉じている。ここで出た順位をそのまま本番アーキテクチャの選定根拠にすると、CDN キャッシュ率やサーバ負荷という支配的な要因を見落とす
> - 計測用に立てた4つのサーバは認証もレート制限も持たない。localhost バインドのまま実行し、外部公開したりデータに実在の個人情報を入れたりしない
>
> **導線**
>
> - コード成果物はない。観察結果と判断根拠を自分の記録へ残し、完成条件で照合する。
>
> **推定時間の内訳**: 4方式の実装と条件そろえに70分、TTFB・HTML サイズの計測に25分、Lighthouse と Performance での FCP/TTI/ハイドレーション計測に35分、オフライン確認と表の考察記述に20分
<!-- handbook:exercise:end -->

**4つのバージョン**:

1. **CSR (純粋なクライアントレンダリング)**: 空の HTML → JavaScript → API → 描画
2. **SSR**: サーバが Todo 一覧を含む HTML を返す
3. **SSG**: ビルド時に全 Todo を埋め込んだ静的 HTML を生成
4. **PWA**: Service Worker でオフライン対応

すべて同じ「Todo 一覧 + 追加 + 完了」機能を持つ。

**計測項目**:

| 項目 | CSR | SSR | SSG | PWA |
|---|---|---|---|---|
| First Contentful Paint (FCP) | | | | |
| Time to Interactive (TTI) | | | | |
| HTML サイズ | | | | |
| サーバ処理時間 | | | | |
| オフラインで動くか | | | | |
| ハイドレーション時間 | - | | | |

**問題**:
- どの方式が最も初期表示が速いか?
- どの方式が SEO に最適か?
- どの方式が動的更新に強いか?
- 各方式が「最も輝く」シナリオは?

模範解答: `code/ch09/mini-ssr/` (SSR) と `code/ch09/pwa-service-worker/` (PWA) の2方式。CSRとSSGは、この2つを土台に読者が組む範囲とする。4方式の比較そのものは計測記録で採点する (演習カードのテスト方法を参照)。

#### 課題9.2: Service Worker でオフライン対応 (★★)

**目的**: PWA の核となる Service Worker を自前で実装する。

<!-- handbook:exercise:start {"id":"9.2"} -->
> **演習カード 課題9.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 9.10 PWA (Progressive Web Apps) ― Webをアプリ化する を読み、install / activate / fetch のライフサイクルを把握しておく
> - Service Worker が localhost か HTTPS でのみ登録できることを理解している
> - 静的ファイルを HTTP で配信する手段 (`python3 -m http.server` など) が使える
> - `pnpm --filter @handbook/ch09 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch09/pwa-service-worker/starter/main.js` に install イベントを実装し、HTML・CSS・JavaScript・オフライン用ページを含むアプリシェルを1つのキャッシュへ登録する
> - [ ] activate イベントで現行バージョン以外のキャッシュを削除して `clients.claim()` を呼び、`message` の `SKIP_WAITING` で待機中の新バージョンを即時有効化できる
> - [ ] fetch イベントで GET かつ同一オリジンのリクエストだけを扱い、それ以外は素通しする
> - [ ] ナビゲーションリクエスト (`request.mode === 'navigate'`) が失敗したときに `offline.html` を返す
> - [ ] 静的アセットは stale-while-revalidate で、キャッシュを即返しつつ裏で更新する
> - [ ] `manifest.webmanifest` を用意し、`display` が `standalone` になっている
>
> **期待出力**
>
> - テスト `service worker includes cache lifecycle, offline navigation, and update path` が pass する
> - 初回アクセス後、DevTools の Application → Cache Storage に指定したキャッシュ名のエントリが並ぶ
> - Application → Service Workers に登録済みの Worker が `activated and is running` と表示される
> - Network を Offline にして再読み込みしても一覧が表示され、未キャッシュのページへ遷移すると `offline.html` が表示される
> - Service Worker のバージョンを上げて再読み込みすると、旧キャッシュが activate 時に削除される
>
> **観察項目**
>
> - DevTools の Application → Service Workers で `waiting to activate` の状態を作り、`SKIP_WAITING` を送る前後で制御タブが切り替わる瞬間を確認する
> - Network タブの Size 列で、Service Worker から返されたレスポンスが `(ServiceWorker)` 表記になることを確認する
> - stale-while-revalidate の裏側の更新リクエストが、画面表示より後に飛んでいることを Network の時系列で確認する
> - POST リクエストを発行し、fetch ハンドラが介入せずネットワークへ素通しされることを確認する
> - キャッシュ名を変えずにファイルだけ更新し、古い内容が返り続ける現象を再現してバージョニングの必要性を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch09 run test` を実行し、Service Worker のテストが pass すれば、必要なライフサイクルと offline 経路がソースに揃っている
> 2. `python3 -m http.server 8080 --directory code/ch09/pwa-service-worker/solution` を起動し、`http://localhost:8080/index.html` を開いて Application → Service Workers が activated になれば登録は成功
> 3. DevTools の Network で Offline にチェックを入れて再読み込みし、アプリシェルが表示されれば合格
> 4. Application → Storage の Clear site data で全消去してから再度アクセスし、初回キャッシュが再構築されれば合格
> 5. Manifest、Service Worker、オフライン遷移、更新、インストール導線を個別に確認し、単一のスコアだけで合否を決めない
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 3つのイベントを一度に書かない。まず install で `cache.addAll` が成功することだけを DevTools の Cache Storage で確認し、それから fetch の介入を足す
> 2. **構造**: `caches.open(CACHE_VERSION)` を軸に、install は addAll、activate は `caches.keys()` の差分削除、fetch は `caches.match` とネットワークの組み合わせ、と役割を1つずつ対応させる。stale-while-revalidate は「キャッシュを返す」と「裏で fetch して put する」の2本を並行させる形になる
> 3. **実装の要点**: `response.clone()` を忘れるとボディが二重読み取りになって落ちる。また裏側の更新 fetch の失敗は必ず catch で握りつぶさないと、オフライン時に未処理拒否が積み上がる
>
> **本番利用時の警告**
>
> - Service Worker はオリジン全体のリクエストを横取りする。認証済みレスポンスや個人情報を含む API 応答をキャッシュすると、同じ端末の別ユーザーやログアウト後に内容が露出する。キャッシュ対象は静的アセットに限定する
> - 登録した Service Worker はキャッシュを消しても残り続ける。バージョニングと `activate` での旧キャッシュ削除を誤ると、利用者の端末に古いアプリが固定され、修正版を配れなくなる
> - 検証は必ず localhost か自分が管理するオリジンで行う。他人のサイトを対象にキャッシュ挙動を試すことはできず、試みるべきでもない
>
> **導線**
>
> - 開始地点: `code/ch09/pwa-service-worker/starter/main.js`
> - 模範解答: `code/ch09/pwa-service-worker/solution/main.js`、`code/ch09/pwa-service-worker/solution/index.html`、`code/ch09/pwa-service-worker/solution/app.js`、`code/ch09/pwa-service-worker/solution/style.css`、`code/ch09/pwa-service-worker/solution/offline.html`、`code/ch09/pwa-service-worker/solution/manifest.webmanifest`
>
> **推定時間の内訳**: install と activate のキャッシュ管理に30分、fetch の分岐と stale-while-revalidate に35分、オフライン遷移と更新経路の DevTools 検証に25分
<!-- handbook:exercise:end -->

**要件**:
- 静的アセット (HTML、CSS、JavaScript、画像) を install 時にキャッシュ
- fetch をインターセプトし、ネットワーク失敗時はキャッシュから返す
- 「Cache First with Network Fallback」戦略
- バックグラウンド更新 (stale-while-revalidate)

```javascript
// sw.js
const CACHE_NAME = 'webbook-v1';
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/style.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Cache hit → 返しつつ、バックグラウンドで更新
      if (cached) {
        fetch(event.request).then((fresh) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh.clone()));
        }).catch(() => {});
        return cached;
      }
      // Cache miss → ネットワークから
      return fetch(event.request);
    }),
  );
});
```

**評価基準**:
- 初回アクセスでキャッシュされる
- 2回目以降はオフラインでも動く
- DevTools の Application → Service Workers で状態確認できる
- Manifest、Service Worker、オフライン遷移、更新、インストール導線を個別にテスト (単一の「PWAスコア」だけを完了条件にしない)

模範解答: `code/ch09/pwa-service-worker/`

#### 課題9.3: 簡易 SSR フレームワークを書く (★★★)

**目的**: Next.js 風のミニ SSR フレームワークを作る。

<!-- handbook:exercise:start {"id":"9.3"} -->
> **演習カード 課題9.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost
>
> **前提**
>
> - 9.2 SSR (Server-Side Rendering) を読み、サーバでの HTML 生成とクライアントのハイドレーションの分担を説明できる状態にする
> - 9.7 戦略の選択基準 を読み、リクエストごとにデータ取得する方式の適用条件を確認しておく
> - Node.js の `http` サーバと動的 `import()` によるモジュール読み込みを書ける
> - `pnpm --filter @handbook/ch09 run test` が実行できる状態にしておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch09/mini-ssr/starter/main.ts` にファイル名からルートを導く関数を実装し、`index` が `/`、`about` が `/about`、`blog/index` が `/blog` になる
> - [ ] ページディレクトリを再帰的に走査して default export を持つモジュールだけをルート表へ登録し、default export が無いファイルではエラーを投げる
> - [ ] `getServerSideProps(context)` があれば await し、その `props` を default export の関数へ渡して HTML 本体を得る
> - [ ] 生成した HTML に props を JSON として埋め込んでハイドレーション用マーカーを出力し、`<`、`>`、`&` をエスケープして `</script>` を含む値でも HTML が壊れない
> - [ ] 登録の無いパスへ 404 を返し、ページ関数が例外を投げたときは 500 を返す
> - [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch09 run test` が全件パスする
>
> **期待出力**
>
> - テスト `routeFromFilename implements file-based routes`、`SSR renders props and hydration marker`、`SSR server returns page and 404`、`discoverPages loads default-exported modules` の4件が pass する
> - クエリ `?name=Alice` を付けたリクエストで、返る HTML に `Hello Alice` が含まれる
> - 返る HTML に `__SSR_PROPS__` と `__HYDRATED__` の2つのマーカーが含まれる
> - `/` が 200 とページ HTML を返し、`/missing` が 404 を返す
> - `discoverPages` が `/` と `/about` の2ルートを持つ Map を返す
>
> **観察項目**
>
> - `curl` で取得した HTML ソースを見て、Todo の中身がクライアント JavaScript の実行前から含まれていることを確認する
> - `getServerSideProps` を持たないページと持つページを両方置き、props が空オブジェクトになる経路を確認する
> - props の値に `</script>` を含む文字列を入れ、エスケープが無い場合に HTML が途中で切れることを再現してからエスケープを戻す
> - ページモジュールを import する際のクエリ (ファイル更新時刻) を外し、ファイルを書き換えてもサーバ再起動まで反映されなくなることを確認する
> - `getServerSideProps` の中で意図的に例外を投げ、500 応答とサーバログの対応を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch09 run test` を実行し、mini SSR の4テストが pass すれば合格
> 2. `pnpm --filter @handbook/ch09 run typecheck` を実行し、`PageModule` と `PageContext` の型でエラー0件なら合格
> 3. `curl -s "http://127.0.0.1:<port>/?name=Alice" -o ssr.html` で保存した HTML に対する `grep -c "Hello Alice" ssr.html` が 1 を返せばサーバ側描画が効いている
> 4. `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/missing` が 404 を返せばルーティングの分岐が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ルーティング、描画、サーバの3つを別関数に分ける。まずファイル名から URL を作る純粋関数だけを書き、テストで固めてから残りへ進む
> 2. **構造**: `routeFromFilename`、`discoverPages`、`renderPage`、`startServer` の4本立てにする。`discoverPages` は再帰走査して動的 `import()` し、`renderPage` は `getServerSideProps` の結果を default export へ渡して HTML 文字列を組み立てる
> 3. **実装の要点**: props をそのまま `JSON.stringify` して `<script>` へ埋めると `</script>` を含む値で HTML が壊れ、XSS の入口になる。`<`、`>`、`&` を Unicode エスケープしてから埋め込む
>
> **本番利用時の警告**
>
> - props の JSON 埋め込みは、エスケープを1つでも落とすとサーバ側データがそのままスクリプト実行につながる XSS になる。本番では実績のあるシリアライザを使い、埋め込む値の出所を限定する
> - この実装はストリーミング、キャッシュ、タイムアウト、同時実行制御を持たない。`getServerSideProps` が遅いページを公開すると、リクエストごとにサーバのイベントループが専有され、少数のアクセスで応答不能になる
> - ページモジュールをディレクトリ走査で動的 import するため、書き込み可能なディレクトリを pages に指定すると任意コード実行になる。走査対象はリポジトリ内の固定パスに限定する
>
> **導線**
>
> - 開始地点: `code/ch09/mini-ssr/starter/main.ts`
> - 模範解答: `code/ch09/mini-ssr/solution/main.ts`、`code/ch09/mini-ssr/solution/pages/index.ts`、`code/ch09/mini-ssr/solution/pages/about.ts`
>
> **推定時間の内訳**: ルート導出とページ探索の実装に45分、renderPage と props シリアライズに45分、HTTP サーバと 404/500 の分岐に35分、curl とテストによる検証に25分
<!-- handbook:exercise:end -->

**要件**:
- ファイルベースルーティング (`pages/index.ts` → `/`、`pages/about.ts` → `/about`)
- 各ページは default export として「コンポーネント関数」を提供
- サーバが HTML をレンダリング、クライアントでハイドレート
- `getServerSideProps()` 相当 (サーバでデータ取得して props として渡す)

```typescript
// pages/index.ts
export async function getServerSideProps() {
  const todos = await db.todo.findMany();
  return { props: { todos } };
}

export default function HomePage({ todos }) {
  return MiniSSR.h('ul', {},
    todos.map((t) => MiniSSR.h('li', { key: t.id }, t.text)),
  );
}
```

模範解答: `code/ch09/mini-ssr/`

---

<!-- handbook:code-usage:start {"chapter":9} -->
### 第9章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第9章の模範解答をまとめて検証する
pnpm --filter @handbook/ch09 run test

# 模範解答を個別に実行する
open code/ch09/pwa-service-worker/solution/index.html            # 課題9.2
pnpm --filter @handbook/ch09 exec tsx mini-ssr/solution/main.ts  # 課題9.3
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch09/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。

`open` は macOS のコマンドである。Linux では `xdg-open`、Windows では `start` を使う。

課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。
<!-- handbook:code-usage:end -->


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。


課題9.1 はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。

---

## まとめ ― 第II部の総括

第II部で更新した知識モデルは、単に「道具が増えた」というものではない。出発点は、ブラウザが提供するDOMとイベントを、状態変化に合わせて人手で同期することの難しさだった。JavaScriptのスコープ、参照、非同期処理、型の境界を理解することで、まず一つの処理がどのように実行されるかを説明できるようになった。フレームワークはその言語機能を使い、状態からUIを導出する規則を共通化した。

コンポーネントが成立すると、次の問題は状態の所有者へ移った。ローカル状態、共有状態、サーバ状態を分離することで、更新通知、キャッシュ、再取得、楽観的更新を同じ問題として扱わずに済むようになった。その分割されたコードを実際に届けるため、ビルドツールが依存グラフを解析し、変換、除去、分割、差し替えを行う。そして最後に、生成したコードとHTMLをいつ・どこで実行するかを選ぶことで、CSR、SSR、SSG、PWAなどのレンダリング戦略を、表示速度や更新頻度に応じて使い分けられるようになった。

ここまでで、利用者の入力を受け、状態を更新し、画面へ反映するフロントエンド側の流れはつながった。しかし、認証、永続化、同時実行制御、業務ルールの正本をブラウザだけに置くことはできない。第III部では、フロントエンドから届く要求を受け取り、複数利用者に対して一貫した結果を返すバックエンドが、どの責務を引き受けるのかを追う。

