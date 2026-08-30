/**
 * 課題7.4: フォームの reactive validation
 *
 * Zodスキーマと統合した、フレームワーク非依存のフォーム制御を実装する。
 */

import { z } from 'zod';

type FieldErrors<T> = Partial<Record<keyof T, string>>;

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

export class FormController<T extends Record<string, unknown>> {
  private state: FormState<T>;
  private listeners = new Set<() => void>();

  constructor(private readonly options: FormOptions<T>) {
    this.state = {
      values: { ...options.initialValues },
      errors: {},
      touched: new Set(),
      isSubmitting: false,
      isValid: false,
    };

    // TODO: 初期状態の妥当性を計算する
  }

  getState(): FormState<T> {
    return {
      ...this.state,
      values: { ...this.state.values },
      errors: { ...this.state.errors },
      touched: new Set(this.state.touched),
    };
  }

  setValue<K extends keyof T>(field: K, value: T[K]): void {
    // TODO: 値を更新し、必要に応じてフィールドを再検証する
  }

  touchField<K extends keyof T>(field: K): void {
    // TODO: touchedへ追加し、そのフィールドだけ検証する
  }

  async submit(): Promise<void> {
    // TODO: 全フィールドを検証し、妥当な場合だけonSubmitを呼ぶ
  }

  reset(): void {
    // TODO: initialValuesへ戻し、エラーとtouchedをクリアする
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private validateField<K extends keyof T>(field: K): void {
    // TODO: Zodのissuesから対象フィールドの最初のエラーを取り出す
  }

  private validateAll(): void {
    // TODO: 全フィールドのエラーとisValidを更新する
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

// 動作確認用スキーマ
const schema = z.object({
  email: z.string().email('有効なメールアドレスを入力'),
  password: z.string().min(8, '8文字以上').regex(/[A-Z]/, '大文字を含めて'),
  age: z.number().int().min(18, '18歳以上'),
});

type FormData = z.infer<typeof schema>;

export const form = new FormController<FormData>({
  schema,
  initialValues: { email: '', password: '', age: 0 },
  onSubmit: async (data) => {
    console.log('Submitted:', data);
  },
});
