exports.up = (pgm) => {
  pgm.createTable('ticket_type_shards', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ticket_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'ticket_types',
      onDelete: 'CASCADE',
    },
    shard_index: { type: 'integer', notNull: true },
    total_quantity: { type: 'integer', notNull: true },
    available_quantity: { type: 'integer', notNull: true },
  });

  pgm.addConstraint('ticket_type_shards', 'shard_quantity_range', {
    check: 'available_quantity >= 0 AND available_quantity <= total_quantity',
  });

  // Each ticket type can only have one shard with a given index
  pgm.addConstraint('ticket_type_shards', 'unique_shard_per_ticket_type', {
    unique: ['ticket_type_id', 'shard_index'],
  });

  // We'll query "find a shard with room, for this ticket type" constantly
  pgm.createIndex('ticket_type_shards', ['ticket_type_id', 'available_quantity']);
};

exports.down = (pgm) => {
  pgm.dropTable('ticket_type_shards');
};
