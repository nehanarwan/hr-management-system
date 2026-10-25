exports.up = (pgm) => {

  pgm.createTable('chat_sessions', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    user_id: { type: 'integer', notNull: true },
    title: { type: 'varchar(255)', notNull: true, default: 'HR Assistant' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('chat_sessions', 'chat_sessions_company_id_id_unique', { unique: ['company_id', 'id'] });

 
  pgm.addConstraint('chat_sessions', 'chat_sessions_user_fkey', {
    foreignKeys: {
      columns: ['company_id', 'user_id'],
      references: 'users(company_id, id)',
      onDelete: 'cascade',
    },
  });

 
  pgm.createTable('chat_messages', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    session_id: { type: 'integer', notNull: true },
    role: { type: 'varchar(20)', notNull: true },
    content: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('chat_messages', 'chat_messages_role_check', {
    check: "role IN ('user', 'assistant')",
  });


  pgm.addConstraint('chat_messages', 'chat_messages_session_fkey', {
    foreignKeys: {
      columns: ['company_id', 'session_id'],
      references: 'chat_sessions(company_id, id)',
      onDelete: 'cascade',
    },
  });


  pgm.createIndex('chat_sessions', ['company_id', 'user_id']);
  pgm.createIndex('chat_messages', ['session_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('chat_messages');
  pgm.dropTable('chat_sessions');
};