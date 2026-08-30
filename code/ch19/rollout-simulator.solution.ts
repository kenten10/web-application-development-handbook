export type RolloutState = { step: number; oldReady: number; newReady: number; unavailable: number; total: number };

export class Rollout {
  constructor(
    readonly options: {
      replicas: number;
      oldVersion: string;
      newVersion: string;
      maxSurge: number;
      maxUnavailable: number;
      newPodFailureRate?: number;
      random?: () => number;
    },
  ) {}

  async execute(onStep?: (state: RolloutState) => void): Promise<RolloutState[]> {
    const { replicas } = this.options;
    // Kubernetes と同じ丸め方。surge は切り上げ、unavailable は切り捨てる
    let maxSurge = Math.ceil(replicas * this.options.maxSurge);
    const maxUnavailable = Math.floor(replicas * this.options.maxUnavailable);
    // 両方0だと1台も動かせない。Kubernetes 同様、この組み合わせは許さず surge を1へクランプする
    if (maxSurge === 0 && maxUnavailable === 0) maxSurge = 1;

    let oldReady = replicas;
    let newReady = 0;
    let step = 0;
    const states: RolloutState[] = [];
    const random = this.options.random ?? Math.random;
    // progressDeadlineSeconds に相当する打ち切り。1台も Ready にならない状態が続いたら
    // 待ち続けても収束しないので、無限ループにせず失敗として扱う
    const stalledLimit = 3;
    let stalledSteps = 0;

    while (newReady < replicas) {
      // 1. スケールアップ。総数が replicas + maxSurge を超えない範囲でだけ新Podを作る
      const room = replicas + maxSurge - (oldReady + newReady);
      const create = Math.min(Math.max(room, 0), replicas - newReady);
      if (create === 0) throw new Error('rollout cannot make progress');

      let succeeded = 0;
      for (let i = 0; i < create; i++) if (random() >= (this.options.newPodFailureRate ?? 0)) succeeded++;
      newReady += succeeded;

      // 2. 状態はスケールアップ直後、つまり Pod 数が最大になる瞬間で記録する。
      //    旧Podを落としたあとで記録すると surge の山が観測できず、
      //    「total の最大が replicas + maxSurge になる」ことを確かめられない
      const state: RolloutState = {
        step: ++step,
        oldReady,
        newReady,
        unavailable: Math.max(0, replicas - (oldReady + newReady)),
        total: oldReady + newReady,
      };
      states.push(state);
      onStep?.(state);

      stalledSteps = succeeded === 0 ? stalledSteps + 1 : 0;
      if (succeeded === 0 && oldReady === 0) throw new Error('rollout cannot make progress');
      if (stalledSteps >= stalledLimit) throw new Error('rollout cannot make progress');

      // 3. スケールダウン。利用可能数が replicas - maxUnavailable を下回らない範囲でだけ旧Podを落とす
      const removable = Math.max(0, oldReady + newReady - (replicas - maxUnavailable));
      oldReady -= Math.min(oldReady, removable);

      await Promise.resolve();
    }
    return states;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await new Rollout({
    replicas: 10,
    oldVersion: 'v1',
    newVersion: 'v2',
    maxSurge: 0.25,
    maxUnavailable: 0.25,
    newPodFailureRate: 0,
  }).execute(s => console.log(JSON.stringify(s)));
}
