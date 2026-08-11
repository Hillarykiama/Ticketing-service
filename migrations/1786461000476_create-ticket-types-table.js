exports.up = (pgm) => {
  pgm.createTable('ticket_types', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    price_cents: { type: 'integer', notNull: true },
    total_quantity: { type: 'integer', notNull: true },
    available_quantity: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Enforce at the DB level that available_quantity never goes negative or exceeds total
  pgm.addConstraint('ticket_types', 'available_quantity_range', {
    check: 'available_quantity >= 0 AND available_quantity <= total_quantity',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ticket_types');
};
