exports.up = (pgm) => {
  pgm.dropColumn('ticket_types', ['available_quantity', 'total_quantity']);
};

exports.down = (pgm) => {
  pgm.addColumn('ticket_types', {
    available_quantity: { type: 'integer', notNull: true, default: 0 },
    total_quantity: { type: 'integer', notNull: true, default: 0 },
  });
};
