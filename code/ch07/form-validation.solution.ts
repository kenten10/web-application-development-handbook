/**
 * 課題7.4 模範解答: フォームの reactive validation
 *
 * Zod スキーマと統合した、React Hook Form 風のフォームヘルパ。
 * このファイルは framework-agnostic な「核」を実装する。
 * React と統合する場合は useReducer + useSyncExternalStore で.
 */

import { z } from 'zod';

type FieldErrors<T> = Partial<Record<keyof T, string>>;
type ValuesOf<T> = T;

interface FormState<T> {
  values: T;
  errors: FieldErrors<T>;
  touched: Set<keyof T>;
  isSubmitting: boolean;
  isValid: boolean;
}

interface FormOptions<T> {
  schema: z.ZodType<T>;
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
}

export class FormController<T extends Record<string, any>> {
  private state: FormState<T>;
  private listeners = new Set<() => void>();

  constructor(private opts: FormOptions<T>) {
    this.state = {
      values: { ...opts.initialValues },
      errors: {},
      touched: new Set(),
      isSubmitting: false,
      isValid: false,
    };
    this.validate(false); // 初期 validity 計算
  }

  // 状態取得
  getValues(): T {
    return this.state.values;
  }

  getErrors(): FieldErrors<T> {
    return this.state.errors;
  }

  getState(): FormState<T> {
    return { ...this.state, errors: { ...this.state.errors }, touched: new Set(this.state.touched) };
  }

  // 値設定
  setValue<K extends keyof T>(field: K, value: T[K]): void {
    this.state.values[field] = value;
    if (this.state.touched.has(field)) {
      this.validateField(field);
    } else {
      // 未 touch でも全体 validity は更新
      this.validate(false);
    }
    this.notify();
  }

  // フィールドを「触れた」ことにする(blur で呼ぶ)
  touchField<K extends keyof T>(field: K): void {
    if (!this.state.touched.has(field)) {
      this.state.touched.add(field);
      this.validateField(field);
      this.notify();
    }
  }

  // 単一フィールドの検証
  private validateField<K extends keyof T>(field: K): void {
    const result = this.opts.schema.safeParse(this.state.values);
    if (result.success) {
      delete this.state.errors[field];
    } else {
      const fieldError = result.error.issues.find((issue) => issue.path[0] === field);
      if (fieldError) {
        this.state.errors[field] = fieldError.message;
      } else {
        delete this.state.errors[field];
      }
    }
    this.updateValidity();
  }

  // 全体検証
  private validate(setAllErrors: boolean): void {
    const result = this.opts.schema.safeParse(this.state.values);
    if (setAllErrors) {
      this.state.errors = {};
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof T;
          if (!this.state.errors[key]) {
            this.state.errors[key] = issue.message;
          }
        }
      }
    }
    this.updateValidity();
  }

  private updateValidity(): void {
    const result = this.opts.schema.safeParse(this.state.values);
    this.state.isValid = result.success;
  }

  // フォーム送信
  async submit(): Promise<void> {
    // 全フィールド touched + 全体検証
    for (const k of Object.keys(this.state.values)) this.state.touched.add(k as keyof T);
    this.validate(true);
    this.notify();

    if (!this.state.isValid) {
      return;
    }

    this.state.isSubmitting = true;
    this.notify();
    try {
      await this.opts.onSubmit(this.state.values);
    } finally {
      this.state.isSubmitting = false;
      this.notify();
    }
  }

  // リセット
  reset(): void {
    this.state.values = { ...this.opts.initialValues };
    this.state.errors = {};
    this.state.touched.clear();
    this.state.isSubmitting = false;
    this.validate(false);
    this.notify();
  }

  // 購読
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of [...this.listeners]) l();
  }
}

// === 使用例 ===

if (import.meta.url === `file://${process.argv[1]}`) {
  const schema = z.object({
    email: z.string().email('有効なメールアドレスを入力'),
    password: z.string().min(8, '8文字以上').regex(/[A-Z]/, '大文字を含めて'),
    age: z.number().int().min(18, '18歳以上'),
  });
  type FormData = z.infer<typeof schema>;

  const form = new FormController<FormData>({
    schema,
    initialValues: { email: '', password: '', age: 0 },
    onSubmit: async (data) => {
      console.log('Submitted:', data);
    },
  });

  form.subscribe(() => {
    const s = form.getState();
    console.log('State:', {
      values: s.values,
      errors: s.errors,
      isValid: s.isValid,
    });
  });

  console.log('=== Test 1: 初期状態 ===');
  console.log('isValid:', form.getState().isValid); // false (空)

  console.log('\n=== Test 2: 1フィールドずつ入力 ===');
  form.setValue('email', 'invalid');
  form.touchField('email');
  // errors.email が表示される

  form.setValue('email', 'user@example.com');
  // errors.email 消える

  form.setValue('password', 'short');
  form.touchField('password');
  // errors.password が表示

  form.setValue('password', 'ValidPass8');
  form.setValue('age', 17);
  form.touchField('age');
  // errors.age が表示

  form.setValue('age', 25);
  console.log('Final isValid:', form.getState().isValid); // true

  console.log('\n=== Test 3: submit ===');
  form.submit();
}
