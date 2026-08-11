exports.up = (pgm) => {
  pgm.createTable('orders', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: { type: 'uuid', notNull: true },
    ticket_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'ticket_types',
      onDelete: 'RESTRICT',
    },
    quantity: { type: 'integer', notNull: true },
    status: { type: 'text', notNull: true, default: 'pending_payment' },
    payment_ref: { type: 'text' },
    reserved_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
  });

  pgm.addConstraint('orders', 'orders_status_check', {
    check: "status IN ('pending_payment', 'paid', 'expired', 'cancelled')",
  });

  pgm.addConstraint('orders', 'orders_quantity_positive', {
    check: 'quantity > 0',
  });

  // We'll query "find expired pending orders" constantly (reconciliation job) — index it
  pgm.createIndex('orders', ['status', 'expires_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('orders');
};
