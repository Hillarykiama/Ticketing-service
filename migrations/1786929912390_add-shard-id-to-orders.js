exports.up = (pgm) => {
  pgm.addColumn('orders', {
    shard_id: {
      type: 'uuid',
      references: 'ticket_type_shards',
      onDelete: 'RESTRICT',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('orders', 'shard_id');
};
