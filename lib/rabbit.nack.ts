export class Nack {

  private readonly _requeue: boolean = false;

  constructor(requeue = false) {
    this._requeue = requeue;
  }

  get requeue(): boolean {
    return this._requeue;
  }

}

export type RpcResponse<T> = T | Nack;
export type SubscribeResponse = Nack | undefined | void;
