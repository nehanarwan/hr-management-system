exports.up = (pgm) => {
 
  pgm.createTable('companies', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    slug: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('companies', 'companies_slug_unique', { unique: ['slug'] });

 
  pgm.createTable('users', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    email: { type: 'varchar(255)', notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(50)', notNull: true, default: 'employee' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('users', 'users_company_email_unique', { unique: ['company_id', 'email'] });
  pgm.addConstraint('users', 'users_company_id_id_unique', { unique: ['company_id', 'id'] });
  pgm.addConstraint('users', 'users_role_check', {
    check: "role IN ('employee', 'manager', 'admin')",
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
  pgm.dropTable('companies');
};