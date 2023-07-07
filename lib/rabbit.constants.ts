export enum RabbitToken {
  moduleOptions = 'rabbit_module_options_token',
  pubOptions = 'rabbit_module_pub_options_token',
  connection = 'rabbit_module_connection_token',
  channel = 'rabbit_module_channel_token',
  publisher = 'rabbit_module_publisher_token',
  queueConsumer = 'rabbit_module_queue_consumer',
  consumeController = 'rabbit_module_consume_controller',
  payload = 'rabbit_module_payload_token',
  validate = 'rabbit_module_validate_token',
  transform = 'rabbit_module_transform_token',
}

export enum Errors {
  FAILED_EXCHANGE = 'FAILED_EXCHANGE',
}
