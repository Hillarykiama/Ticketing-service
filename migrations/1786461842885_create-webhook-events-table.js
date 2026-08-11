exports.up = (pgm) => {
  pgm.createTable('webhook_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    provider: { type: 'text', notNull: true },
    event_id: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    processed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // This is the actual idempotency guarantee: the same provider+event_id
  // can only be inserted once. A duplicate webhook delivery hits this
  // constraint and we treat it as "already handled" instead of reprocessing.
  pgm.addConstraint('webhook_events', 'webhook_events_provider_event_unique', {
    unique: ['provider', 'event_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('webhook_events');
};