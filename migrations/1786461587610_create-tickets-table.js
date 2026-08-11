exports.up = (pgm) => {
  pgm.createTable('tickets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders',
      onDelete: 'RESTRICT',
    },
    qr_code: { type: 'text', notNull: true, unique: true },
    checked_in_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Fast lookup: "does this order already have tickets issued?" — used by the
  // reconciliation job to detect paid orders with no ticket yet
  pgm.createIndex('tickets', 'order_id');
};

exports.down = (pgm) => {
  pgm.dropTable('tickets');
};
