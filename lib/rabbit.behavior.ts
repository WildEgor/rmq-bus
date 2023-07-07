import { Channel } from 'rabbitmq-client';
import { AsyncMessage, Cmd, MethodParams } from 'rabbitmq-client/lib/codec';
// eslint-disable-next-line import/no-cycle
import { MessageHandlerErrorBehavior } from './rabbit.interfaces';

export type MessageErrorHandler = (
  channel: Channel,
  msg: AsyncMessage,
  error: any
) => Promise<void> | void;

export const ackErrorHandler: MessageErrorHandler = (channel, msg) => {
  channel.basicAck({
    deliveryTag: msg.deliveryTag,
    multiple: false,
  });
};

export const requeueErrorHandler: MessageErrorHandler = (channel, msg) => {
  channel.basicNack({
    deliveryTag: msg.deliveryTag,
    multiple: false,
    requeue: true,
  });
};

export const defaultNackErrorHandler: MessageErrorHandler = (channel, msg) => {
  channel.basicNack({
    deliveryTag: msg.deliveryTag,
    multiple: false,
    requeue: false,
  });
};

export const getHandlerForLegacyBehavior = (
  behavior?: MessageHandlerErrorBehavior,
): MessageErrorHandler => {
  switch (behavior) {
    case MessageHandlerErrorBehavior.ACK:
      return ackErrorHandler;
    case MessageHandlerErrorBehavior.REQUEUE:
      return requeueErrorHandler;
    default:
      return defaultNackErrorHandler;
  }
};

export type AssertQueueErrorHandler = (
  channel: Channel,
  queueName: string,
  // queueOptions: QueueOptions | undefined,
  error: any
) => Promise<string> | string;

export const defaultAssertQueueErrorHandler: unknown = (
  _channel: Channel,
  _queueName: string,
  _queueOptions: MethodParams[Cmd.QueueDeclare] | undefined,
  error: any,
) => {
  throw error;
};

export const forceDeleteAssertQueueErrorHandler: unknown = async(
  channel: Channel,
  queueName: string,
  queueOptions: MethodParams[Cmd.QueueDeclare] | undefined,
  error: any,
) => {
  if (error?.code === 406) {
    // 406 == preconditions failed
    await channel.queueDelete({
      queue: queueName,
    });
    const { queue } = await channel.queueDeclare({
      queue: queueName,
      ...queueOptions,
    });
    return queue;
  }
  throw error;
};
