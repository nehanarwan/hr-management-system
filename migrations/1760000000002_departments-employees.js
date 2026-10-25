exports.up = (pgm) => {

  pgm.createTable('departments', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    manager_id: { type: 'integer' },
    name: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('departments', 'departments_company_name_unique', { unique: ['company_id', 'name'] });
  pgm.addConstraint('departments', 'departments_company_id_id_unique', { unique: ['company_id', 'id'] });


  pgm.createTable('employees', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    department_id: { type: 'integer' },
    user_id: { type: 'integer' },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('employees', 'employees_user_id_unique', { unique: ['user_id'] });
  pgm.addConstraint('employees', 'employees_company_id_id_unique', { unique: ['company_id', 'id'] });


  pgm.addConstraint('employees', 'employees_department_fkey', {
    foreignKeys: {
      columns: ['company_id', 'department_id'],
      references: 'departments(company_id, id)',
    },
  });

  pgm.addConstraint('employees', 'employees_user_fkey', {
    foreignKeys: {
      columns: ['company_id', 'user_id'],
      references: 'users(company_id, id)',
    },
  });

  pgm.addConstraint('departments', 'departments_manager_fkey', {
    foreignKeys: {
      columns: ['company_id', 'manager_id'],
      references: 'employees(company_id, id)',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('departments', 'departments_manager_fkey');
  pgm.dropTable('employees');
  pgm.dropTable('departments');
};