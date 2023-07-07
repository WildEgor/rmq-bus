import { RabbitToken } from './rabbit.constants';

export const getRabbitConnectionToken = (connectionName?: string): string => (connectionName ? `${connectionName}-AMQP_CONNECTION` : RabbitToken.connection);

export const getRabbitChannelToken = (connectionName?: string): string => (connectionName ? `${connectionName}-AMQP_CHANNEL` : RabbitToken.channel);

export const getRabbitPublisherToken = (connectionName?: string): string => (connectionName ? `${connectionName}-AMQP_PUBLISHER` : RabbitToken.publisher);
