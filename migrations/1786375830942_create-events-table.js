exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createTable('events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organizer_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true },
    starts_at: { type: 'timestamptz', notNull: true },
    status: { type: 'text', notNull: true, default: 'draft' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('events');
};
