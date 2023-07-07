import { AsyncMessage, MessageBody } from 'rabbitmq-client/lib/codec';

export class RabbitPayload implements AsyncMessage {

  headers: { [p: string]: any, CC?: string[] | undefined, BCC?: string[] | undefined } | undefined;
  body: MessageBody;
  consumerTag: string;
  deliveryTag: number;
  exchange: string;
  redelivered: boolean;
  routingKey: string;

  constructor(msg: AsyncMessage) {
    this.body = msg.body;
    this.consumerTag = msg.consumerTag;
    this.deliveryTag = msg.deliveryTag;
    this.exchange = msg.exchange;
    this.redelivered = msg.redelivered;
    this.routingKey = msg.routingKey;
    this.headers = msg.headers;
  }

  public get content(): any | undefined {
    if (!Buffer.isBuffer(this.body)) {
      return this.body;
    }

    const buf = this.body.toString();

    try {
      const parsed = JSON.parse(buf);
      return parsed;
    }
    catch (e) {
      return undefined;
    }
  }

  public getDebugString(): string {
    try {
      const content = JSON.parse(this.body.toString());
      const debugMsg = {
        headers: this.headers,
        message: this.maskBuffers(content),
      };
      return JSON.stringify(debugMsg);
    }
    catch (e: unknown) {
      if (e instanceof Error) {
        return e.message;
      }
    }

    return 'UNRECOGNIZED_ERROR';
  }

  private maskBuffers(obj: any): any {
    const result: any = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in obj) {
      if (obj[prop].type === 'Buffer') {
        result[prop] = `Buffer - length ${(obj[prop].data as Buffer).length}`;
      }
      else {
        result[prop] = obj[prop];
      }
    }
    return result;
  }

}
